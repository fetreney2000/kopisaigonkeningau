// Kriptografi + sesi log masuk - ikut OWASP (Password Storage & Session Management)
// Kata laluan: HMAC-SHA256(pepper) → PBKDF2-SHA256(salt). Sesi: token raw dalam kuki,
// hash SHA-256 sahaja dalam D1. Pepper tidak pernah disimpan dalam pangkalan data.

import type { D1Database } from '@cloudflare/workers-types';

export const SESSION_COOKIE = 'sg_session';
export const SESSION_MAX_AGE = 30 * 86400; // 30 hari (saat)
// OWASP mengesyorkan kira-kira 600,000 lelaran untuk PBKDF2-HMAC-SHA256, tetapi had
// CPU 10 ms pelan Workers percuma membataskan nilai yang praktikal di sini. Format
// hash tersimpan membawa bilangan lelaran sendiri, jadi bila pelan berubah (atau had
// CPU dilonggarkan), naikkan pemalar ini sahaja: hash lama disemak dengan lelaran
// lama, kemudian dinaik taraf secara automatik semasa log masuk seterusnya.
export const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();

/** Uint8Array dengan buffer sendiri (untuk API BufferSource yang ketat jenisnya) */
function bytes(s: string): Uint8Array<ArrayBuffer> {
  const src = enc.encode(s);
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
}

// ------------------------------------------------------------------ util bytes

function b64u(buf: Uint8Array): string {
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): Uint8Array<ArrayBuffer> {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Perbandingan masa-malar (portable) - jangan guna === untuk hash */
function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ------------------------------------------------------------------ kata laluan

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, pepper: string, iterations: number): Promise<Uint8Array> {
  const pepperKey = await crypto.subtle.importKey('raw', bytes(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const peppered = new Uint8Array(await crypto.subtle.sign('HMAC', pepperKey, bytes(password)));
  const pwKey = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, pwKey, 256)
  );
}

/** Format berjejak: pbkdf2_sha256$<iterasi>$<saltB64>$<hashB64> - mudah dinaik taraf */
export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, pepper, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${b64u(salt)}$${b64u(hash)}`;
}

export async function verifyPassword(stored: string, password: string, pepper: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = parseInt(parts[1]!, 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  try {
    const salt = b64uDecode(parts[2]!);
    const storedHash = b64uDecode(parts[3]!);
    const candidate = await derive(password, salt, pepper, iterations);
    return timingSafeEq(candidate, storedHash);
  } catch {
    return false;
  }
}

/** Bilangan lelaran daripada hash tersimpan (null jika format tidak dikenali) */
export function passwordHashIterations(stored: string): number | null {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return null;
  const n = parseInt(parts[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/** Untuk username tidak dikenali - jalankan derivasi sama supaya masa tindak balas seragam */
const DUMMY_SALT = new Uint8Array(16);
export async function dummyDerive(password: string, pepper: string): Promise<void> {
  await derive(password, DUMMY_SALT, pepper, PBKDF2_ITERATIONS);
}

// ------------------------------------------------------------------ token & kod

export async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randCode(prefix: string, len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${out}`;
}

/** Kata laluan sementara yang boleh dibaca/ditaip dengan mudah */
export function tempPassword(): string {
  return `Kopi-${randCode('X', 6).slice(2)}`;
}

// ------------------------------------------------------------------ sesi

export interface AuthUser {
  id: string;
  full_name: string;
  username: string;
  position: string;
  role: 'admin' | 'staff';
}

const USER_COLS = 'id, full_name, username, position, role';

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32))); // 256 bit raw
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const r = await db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(tokenHash, userId, expiresAt, new Date().toISOString())
    .run();
  if (!r.success) throw new Error('Gagal mencipta sesi');
  // Buang sesi luput semasa peluang ini (pembersihan murah)
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(Date.now()).run();
  return token;
}

export async function getSessionUser(db: D1Database, token: string): Promise<AuthUser | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT ${USER_COLS} FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.archived = 0`
    )
    .bind(tokenHash, Date.now())
    .first<AuthUser>();
  return row ?? null;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(token)).run();
}

/** Padam semua sesi seorang pengguna (selepas tukar kata laluan / lumpuhkan akaun) */
export async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run();
}

// ------------------------------------------------------------------ kuki

export function sessionCookie(token: string, secure: boolean, clear = false): string {
  const base = `${SESSION_COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_MAX_AGE}`;
  return secure ? `${base}; Secure` : base;
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin');
  if (!origin) return true; // pelanggan tanpa Origin (cth. curl) - kuki SameSite tetap melindungi
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}
