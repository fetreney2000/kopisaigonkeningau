import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import type {
  Adjustment, AdjustmentRow, AuthMe, CategoryRow, Item, ItemWithStock, MonthRow, Movement, Purchase, Reports, Source, SourceTotals, StaffHome, StaffItem, StaffUsageRow, StockStatus, Summary, Usage, User,
} from '../shared/types';
import {
  SESSION_COOKIE, createSession, deleteSession, deleteUserSessions, dummyDerive, getSessionUser,
  hashPassword, passwordHashIterations, PBKDF2_ITERATIONS, readCookie, sameOrigin, sessionCookie,
  sha256Hex, tempPassword, verifyPassword,
  type AuthUser,
} from './auth';

type Env = { DB: D1Database; ASSETS: Fetcher; PASSWORD_PEPPER?: string; SETUP_TOKEN?: string };
type Vars = { user: AuthUser | null };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---------------------------------------------------------------- utiliti

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I/O/0/1 untuk elak keliru
function genId(prefix: string, len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}-${out}`;
}

// Zon masa Malaysia (MYT, UTC+8, tiada DST) - semua tarikh direkod ikut waktu Kuala Lumpur
const KL_OFFSET_MS = 8 * 3600_000;

function klNow(): Date {
  return new Date(Date.now() + KL_OFFSET_MS);
}

function today(): string {
  return klNow().toISOString().slice(0, 10);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function statusOf(stock: number, minQty: number): StockStatus {
  if (stock <= 0) return 'habis';
  if (minQty > 0 && stock <= minQty) return 'rendah';
  if (minQty > 0 && stock <= minQty * 1.2) return 'hampir';
  return 'ok';
}

/** Kedudukan keterukan status untuk pengisihan */
const SEVERITY: Record<StockStatus, number> = { habis: 0, rendah: 1, hampir: 2, ok: 3 };

interface StockRow { id: string; pur: number; us: number; adj: number }

async function stockByItem(db: D1Database): Promise<Map<string, number>> {
  const rows = await db
    .prepare(
      `SELECT i.id AS id,
              COALESCE(p.pur, 0) AS pur,
              COALESCE(u.us, 0)  AS us,
              COALESCE(a.adj, 0) AS adj
       FROM items i
       LEFT JOIN (SELECT item_id, SUM(qty) AS pur FROM purchases GROUP BY item_id) p ON p.item_id = i.id
       LEFT JOIN (SELECT item_id, SUM(qty) AS us  FROM usages     GROUP BY item_id) u ON u.item_id = i.id
       LEFT JOIN (SELECT item_id, SUM(delta) AS adj FROM adjustments GROUP BY item_id) a ON a.item_id = i.id
       WHERE i.archived = 0`
    )
    .all<{ id: string; pur: number; us: number; adj: number }>();
  const map = new Map<string, number>();
  for (const r of (rows.results ?? []) as StockRow[]) map.set(r.id, num(r.pur) - num(r.us) + num(r.adj));
  return map;
}

async function usage30ByItem(db: D1Database): Promise<Map<string, number>> {
  const since = new Date(Date.now() + KL_OFFSET_MS - 30 * 86400_000).toISOString().slice(0, 10);
  const rows = await db
    .prepare('SELECT item_id, SUM(qty) AS qty FROM usages WHERE date >= ?1 GROUP BY item_id')
    .bind(since)
    .all<{ item_id: string; qty: number }>();
  const map = new Map<string, number>();
  for (const r of rows.results ?? []) map.set(r.item_id, num(r.qty));
  return map;
}

function decorate(item: Item, stock: number, usage30: number): ItemWithStock {
  const daily_rate = usage30 / 30;
  const days_left = daily_rate > 0 ? stock / daily_rate : null;
  return {
    ...item,
    stock,
    status: statusOf(stock, item.min_qty),
    daily_rate,
    days_left: days_left === null ? null : Math.round(days_left * 10) / 10,
    projected_monthly_cost: Math.round(daily_rate * 30 * item.unit_cost * 100) / 100,
  };
}

const emptyTotals = (): SourceTotals => ({ franchisor: 0, local: 0 });
function addTotals(t: SourceTotals, source: string, v: number) {
  if (source === 'franchisor') t.franchisor += v;
  else t.local += v;
}

/** Versi item tanpa kos - untuk peranan staff (tiada perbelanjaan dipaparkan) */
function staffItem(item: Item, stock: number): StaffItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    source: item.source,
    min_qty: item.min_qty,
    stock,
    status: statusOf(stock, item.min_qty),
  };
}

function jsonError(msg: string, code = 400) {
  return Response.json({ error: msg }, { status: code });
}

// ---------------------------------------------------------------- API

const api = new Hono<{ Bindings: Env; Variables: Vars }>();

// -- Pengepala keselamatan + polisi cache ---------------------------------------
// Didaftarkan sebelum mana-mana route (Hono ikut urutan pendaftaran). Untuk halaman
// HTML statik yang dihidang langsung dari ASSETS, lihat fail public/_headers.
api.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
});

api.get('/health', (c) => c.json({ ok: true }));

// -- Penyelesaian sesi untuk semua laluan /api --------------------------------
api.use('*', async (c, next) => {
  const token = readCookie(c.req.header('Cookie'), SESSION_COOKIE);
  c.set('user', token ? await getSessionUser(c.env.DB, token) : null);
  await next();
});

// -- Penjaga akses ---------------------------------------------------------------
const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!c.get('user')) return jsonError('Perlu log masuk', 401);
  await next();
};

const adminOnly: MiddlewareHandler = async (c, next) => {
  if (c.get('user')?.role !== 'admin') return jsonError('Tiada kebenaran (admin sahaja)', 403);
  await next();
};

/** Laluan yang dibenarkan untuk staff (selain daripada admin) */
function staffAllowed(path: string, method: string): boolean {
  if (method === 'GET' && (path === '/api/staff/home' || path === '/api/items' || path.startsWith('/api/items/lookup/'))) return true;
  if (method === 'POST' && path === '/api/usages') return true;
  return false;
}

api.use('*', async (c, next) => {
  const p = c.req.path;
  if (p === '/api/health' || p.startsWith('/api/auth/')) return next();
  const user = c.get('user');
  if (!user) return jsonError('Perlu log masuk', 401);
  if (user.role !== 'admin' && !staffAllowed(p, c.req.method)) return jsonError('Tiada kebenaran', 403);
  await next();
});

// -- Autentikasi (awam) ---------------------------------------------------------
function pepperOf(env: Env): string {
  if (!env.PASSWORD_PEPPER) throw new Error('PASSWORD_PEPPER tidak ditetapkan. Jalankan `wrangler secret put PASSWORD_PEPPER`');
  return env.PASSWORD_PEPPER;
}

function clientIp(c: { req: { header: (k: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? 'local';
}

/** Had kadar log masuk dalam-tinggalan: 5 gagalan → kunci 60 saat (per akaun+IP) */
const loginFails = new Map<string, { n: number; until: number }>();
function loginAllowed(key: string): boolean {
  const e = loginFails.get(key);
  return !e || e.until <= Date.now();
}
function recordLoginFail(key: string) {
  const now = Date.now();
  const e = loginFails.get(key) ?? { n: 0, until: 0 };
  e.n += 1;
  if (e.n >= 5) {
    e.until = now + 60_000;
    e.n = 0;
  }
  loginFails.set(key, e);
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;

/** Cipta pengguna baharu (dikongsi oleh persediaan & pentadbir admin) */
async function createUser(c: Context<{ Bindings: Env; Variables: Vars }>, role: 'admin' | 'staff') {
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return jsonError('Borang tidak sah');
  const full_name = str(b.full_name);
  const username = str(b.username).toLowerCase();
  const position = str(b.position);
  const password = str(b.password);
  if (!full_name) return jsonError('Nama penuh diperlukan');
  if (!USERNAME_RE.test(username)) return jsonError('Nama pengguna mesti 3-32 aksara (huruf kecil, nombor, . _ -)');
  if (password.length < 8) return jsonError('Kata laluan mesti sekurang-kurangnya 8 aksara');
  if (password.length > 64) return jsonError('Kata laluan terlalu panjang (maks 64)');

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?1').bind(username).first();
  if (exists) return jsonError('Nama pengguna sudah digunakan');

  const id = genId('USR');
  const qrCode = genId('USR', 12); // 60 bit entropi - kod QR log masuk kekal (bearer)
  const hash = await hashPassword(password, pepperOf(c.env));
  const r = await c.env.DB.prepare(
    `INSERT INTO users (id, full_name, username, position, role, password_hash, qr_token_hash, created_at, archived)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)`
  ).bind(id, full_name, username, position, role, hash, await sha256Hex(qrCode), new Date().toISOString()).run();
  if (!r.success) return jsonError('Gagal mencipta pengguna', 500);
  return c.json({
    user: { id, full_name, username, position, role } satisfies AuthUser,
    qr_code: qrCode, // dipaparkan sekali sahaja untuk dicetak
  }, 201);
}

api.get('/auth/me', async (c) => {
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE archived = 0').first<{ n: number }>();
  const user = c.get('user');
  return c.json<AuthMe>({ user, needs_setup: (n?.n ?? 0) === 0 });
});

api.post('/auth/setup', async (c) => {
  if (!sameOrigin(c.req.raw)) return jsonError('Asal permintaan tidak sah', 403);
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE archived = 0').first<{ n: number }>();
  if ((n?.n ?? 0) > 0) return jsonError('Akaun sudah wujud. Sila log masuk', 403);
  // Jika SETUP_TOKEN ditetapkan sebagai secret, persediaan mesti membawanya.
  // Ini menghalang orang asing yang terjumpa URL daripada merampas akaun admin
  // pertama sebelum pemilik sempat membuat persediaan.
  const expected = c.env.SETUP_TOKEN;
  if (expected) {
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const provided = str(b?.token);
    const [given, wanted] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
    if (given !== wanted) return jsonError('Token persediaan tidak sah', 403);
  }
  return createUser(c, 'admin');
});

api.post('/auth/login', async (c) => {
  if (!sameOrigin(c.req.raw)) return jsonError('Asal permintaan tidak sah', 403);
  const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return jsonError('Borang tidak sah');
  const username = str(b.username).toLowerCase();
  const password = str(b.password);
  if (!username || !password) return jsonError('Nama pengguna dan kata laluan diperlukan');

  const key = `${username}|${clientIp(c)}`;
  if (!loginAllowed(key)) return jsonError('Terlalu banyak percubaan. Cuba lagi dalam 1 minit.', 429);

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?1 AND archived = 0').bind(username).first<User & { password_hash: string }>();
  if (!row) {
    await dummyDerive(password, pepperOf(c.env)); // masa tindak balas seragam
    recordLoginFail(key);
    return jsonError('Nama pengguna atau kata laluan salah', 401);
  }
  if (!(await verifyPassword(row.password_hash, password, pepperOf(c.env)))) {
    recordLoginFail(key);
    return jsonError('Nama pengguna atau kata laluan salah', 401);
  }

  // Naik taraf hash kepada bilangan lelaran semasa jika masih menggunakan tetapan lama
  if (passwordHashIterations(row.password_hash) !== PBKDF2_ITERATIONS) {
    const newHash = await hashPassword(password, pepperOf(c.env));
    await c.env.DB.prepare('UPDATE users SET password_hash = ?2 WHERE id = ?1').bind(row.id, newHash).run();
  }

  loginFails.delete(key);
  const token = await createSession(c.env.DB, row.id);
  c.header('Set-Cookie', sessionCookie(token, new URL(c.req.url).protocol === 'https:'));
  return c.json({ user: { id: row.id, full_name: row.full_name, username: row.username, position: row.position, role: row.role } satisfies AuthUser });
});

api.post('/auth/qr-login', async (c) => {
  if (!sameOrigin(c.req.raw)) return jsonError('Asal permintaan tidak sah', 403);
  const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const code = str(b?.code).toUpperCase();
  // 8 aksara = format lama (kod sedia ada kekal sah), 12 aksara = format baharu
  if (!/^USR-[A-Z2-9]{8}([A-Z2-9]{4})?$/.test(code)) return jsonError('Kod QR log masuk tidak sah', 401);

  const key = `qr|${clientIp(c)}`;
  if (!loginAllowed(key)) return jsonError('Terlalu banyak percubaan. Cuba lagi dalam 1 minit.', 429);

  const row = await c.env.DB.prepare('SELECT id, full_name, username, position, role FROM users WHERE qr_token_hash = ?1 AND archived = 0')
    .bind(await sha256Hex(code)).first<AuthUser>();
  if (!row) {
    recordLoginFail(key);
    return jsonError('Kod QR tidak sah atau sudah tidak aktif', 401);
  }

  loginFails.delete(key);
  const token = await createSession(c.env.DB, row.id);
  c.header('Set-Cookie', sessionCookie(token, new URL(c.req.url).protocol === 'https:'));
  return c.json({ user: row });
});

api.post('/auth/logout', async (c) => {
  const token = readCookie(c.req.header('Cookie'), SESSION_COOKIE);
  if (token) await deleteSession(c.env.DB, token);
  c.header('Set-Cookie', sessionCookie('', new URL(c.req.url).protocol === 'https:', true));
  return c.json({ ok: true });
});

// -- Tukar kata laluan sendiri (semua pengguna) --------------------------------
api.post('/auth/change-password', requireAuth, async (c) => {
  if (!sameOrigin(c.req.raw)) return jsonError('Asal permintaan tidak sah', 403);
  const user = c.get('user')!;
  const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return jsonError('Borang tidak sah');
  const current = str(b.current_password);
  const next = str(b.new_password);
  if (!current) return jsonError('Kata laluan semasa diperlukan');
  if (next.length < 8) return jsonError('Kata laluan baharu mesti sekurang-kurangnya 8 aksara');
  if (next.length > 64) return jsonError('Kata laluan baharu terlalu panjang (maks 64)');
  if (next === current) return jsonError('Kata laluan baharu mesti berbeza daripada yang semasa');

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1 AND archived = 0').bind(user.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(row.password_hash, current, pepperOf(c.env)))) {
    return jsonError('Kata laluan semasa salah', 401);
  }

  const hash = await hashPassword(next, pepperOf(c.env));
  const r = await c.env.DB.prepare('UPDATE users SET password_hash = ?2 WHERE id = ?1').bind(user.id, hash).run();
  if (!r.success) return jsonError('Gagal menukar kata laluan', 500);

  // Sesi lain dilumpuhkan, sesi semasa dikekalkan (ikut OWASP Session Management)
  const token = readCookie(c.req.header('Cookie'), SESSION_COOKIE);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1 AND token_hash != ?2')
      .bind(user.id, await sha256Hex(token)).run();
  }
  return c.json({ ok: true });
});

// -- Pengurusan pengguna (admin sahaja) ----------------------------------------
api.get('/users', adminOnly, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, full_name, username, position, role, created_at, archived FROM users
     ORDER BY archived ASC, CASE role WHEN 'admin' THEN 0 ELSE 1 END, full_name COLLATE NOCASE`
  ).all<User>();
  return c.json({ users: rows.results ?? [] });
});

api.post('/users', adminOnly, async (c) => {
  const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const role = str(b?.role) === 'admin' ? 'admin' : 'staff';
  return createUser(c, role);
});

api.patch('/users/:id', adminOnly, async (c) => {
  const me = c.get('user')!;
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return jsonError('Borang tidak sah');

  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1 AND archived = 0').bind(id).first<User & { password_hash: string }>();
  if (!target) return jsonError('Pengguna tidak dijumpai', 404);

  const full_name = str(b.full_name);
  const username = str(b.username).toLowerCase();
  const position = str(b.position);
  const role = str(b.role) === 'admin' ? 'admin' : 'staff';
  if (!full_name) return jsonError('Nama penuh diperlukan');
  if (!USERNAME_RE.test(username)) return jsonError('Nama pengguna mesti 3-32 aksara (huruf kecil, nombor, . _ -)');
  if (id === me.id && role !== target.role) return jsonError('Tidak boleh menukar peranan akaun sendiri', 403);

  const dup = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?1 AND id != ?2').bind(username, id).first();
  if (dup) return jsonError('Nama pengguna sudah digunakan');

  // Pastikan sentiasa ada sekurang-kurangnya satu admin aktif
  if (target.role === 'admin' && role === 'staff') {
    const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND archived = 0 AND id != ?1").bind(id).first<{ n: number }>();
    if ((n?.n ?? 0) < 1) return jsonError('Mesti kekal sekurang-kurangnya satu admin');
  }

  const r = await c.env.DB.prepare('UPDATE users SET full_name = ?2, username = ?3, position = ?4, role = ?5 WHERE id = ?1')
    .bind(id, full_name, username, position, role).run();
  if (!r.success) return jsonError('Gagal menyimpan pengguna', 500);
  return c.json({ ok: true });
});

api.post('/users/:id/reset-password', adminOnly, async (c) => {
  const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const password = str(b?.password) || tempPassword();
  if (password.length < 8) return jsonError('Kata laluan mesti sekurang-kurangnya 8 aksara');
  if (password.length > 64) return jsonError('Kata laluan terlalu panjang (maks 64)');

  const id = c.req.param('id');
  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?1 AND archived = 0').bind(id).first();
  if (!target) return jsonError('Pengguna tidak dijumpai', 404);

  const hash = await hashPassword(password, pepperOf(c.env));
  const r = await c.env.DB.prepare('UPDATE users SET password_hash = ?2 WHERE id = ?1').bind(id, hash).run();
  if (!r.success) return jsonError('Gagal menetapkan semula kata laluan', 500);
  await deleteUserSessions(c.env.DB, id); // sesi lama tidak lagi sah
  return c.json({ password }); // dipaparkan sekali sahaja
});

api.post('/users/:id/rotate-qr', adminOnly, async (c) => {
  const id = c.req.param('id');
  const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?1 AND archived = 0').bind(id).first();
  if (!target) return jsonError('Pengguna tidak dijumpai', 404);
  const qrCode = genId('USR');
  const r = await c.env.DB.prepare('UPDATE users SET qr_token_hash = ?2 WHERE id = ?1').bind(id, await sha256Hex(qrCode)).run();
  if (!r.success) return jsonError('Gagal menukar kod QR', 500);
  return c.json({ qr_code: qrCode }); // kod lama lupus - cetak yang baharu
});

api.delete('/users/:id', adminOnly, async (c) => {
  const me = c.get('user')!;
  const id = c.req.param('id');
  if (id === me.id) return jsonError('Tidak boleh melumpuhkan akaun sendiri', 403);
  const target = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?1 AND archived = 0').bind(id).first<User>();
  if (!target) return jsonError('Pengguna tidak dijumpai', 404);
  if (target.role === 'admin') {
    const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND archived = 0 AND id != ?1").bind(id).first<{ n: number }>();
    if ((n?.n ?? 0) < 1) return jsonError('Mesti kekal sekurang-kurangnya satu admin');
  }
  const r = await c.env.DB.prepare('UPDATE users SET archived = 1 WHERE id = ?1').bind(id).run();
  if (!r.success) return jsonError('Gagal melumpuhkan pengguna', 500);
  await deleteUserSessions(c.env.DB, id);
  return c.json({ ok: true });
});

// -- Dashboard staff (tiada kos/perbelanjaan) -----------------------------------
api.get('/staff/home', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const [itemRows, stockMap, myRows] = await Promise.all([
    db.prepare('SELECT * FROM items WHERE archived = 0').all<Item>(),
    stockByItem(db),
    db.prepare(
      `SELECT u.id, u.item_id, i.name AS item_name, i.unit, u.qty, u.date, u.created_at
       FROM usages u JOIN items i ON i.id = u.item_id
       WHERE u.recorded_by = ?1 AND u.date = ?2 ORDER BY u.created_at DESC LIMIT 50`
    ).bind(user.id, today()).all<StaffUsageRow>(),
  ]);
  const all = itemRows.results ?? [];
  const need_reorder = all
    .map((it) => staffItem(it, stockMap.get(it.id) ?? 0))
    .filter((it) => it.status !== 'ok')
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name));
  return c.json<StaffHome>({ total_items: all.length, need_reorder, my_usage_today: myRows.results ?? [] });
});

// -- Ringkasan papan pemuka (admin sahaja - mengandungi nilai perbelanjaan) ---
api.get('/summary', adminOnly, async (c) => {
  const db = c.env.DB;
  const now = klNow();
  const ym = now.toISOString().slice(0, 7);

  const [itemRows, stockMap, usage30Map, spendRows, usageRows, recentRows] = await Promise.all([
    db.prepare('SELECT * FROM items WHERE archived = 0').all<Item>(),
    stockByItem(db),
    usage30ByItem(db),
    db.prepare(
      `SELECT i.source AS source, SUM(p.qty * p.unit_cost) AS total
       FROM purchases p JOIN items i ON i.id = p.item_id
       WHERE substr(p.date, 1, 7) = ?1 GROUP BY i.source`
    ).bind(ym).all<{ source: string; total: number }>(),
    db.prepare(
      `SELECT i.source AS source, SUM(u.qty * u.unit_cost) AS total
       FROM usages u JOIN items i ON i.id = u.item_id
       WHERE u.date >= ?1 GROUP BY i.source`
    ).bind(new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10)).all<{ source: string; total: number }>(),
    db.prepare(
      `SELECT 'purchase' AS kind, m.id AS id, m.item_id AS item_id, i.name AS item_name, i.unit AS item_unit, i.source AS item_source,
              m.qty AS qty, m.unit_cost AS unit_cost, m.date AS date, m.note AS note, m.created_at AS created_at
       FROM purchases m JOIN items i ON i.id = m.item_id WHERE i.archived = 0
       UNION ALL
       SELECT 'usage', m.id, m.item_id, i.name, i.unit, i.source, m.qty, NULL, m.date, m.note, m.created_at
       FROM usages m JOIN items i ON i.id = m.item_id WHERE i.archived = 0
       UNION ALL
       SELECT 'adjustment', m.id, m.item_id, i.name, i.unit, i.source, m.delta, NULL, m.date, m.reason, m.created_at
       FROM adjustments m JOIN items i ON i.id = m.item_id WHERE i.archived = 0
       ORDER BY created_at DESC LIMIT 10`
    ).all(),
  ]);

  const items: ItemWithStock[] = (itemRows.results ?? []).map((it) =>
    decorate(it, stockMap.get(it.id) ?? 0, usage30Map.get(it.id) ?? 0)
  );

  let stock_value = 0;
  const stock_value_by_source = emptyTotals();
  for (const it of items) {
    const v = Math.max(0, it.stock) * it.unit_cost;
    stock_value += v;
    addTotals(stock_value_by_source, it.source, v);
  }

  const spend_month = emptyTotals();
  for (const r of spendRows.results ?? []) addTotals(spend_month, r.source, num(r.total));

  const usage_cost_30d = emptyTotals();
  const projection_30d = emptyTotals();
  for (const r of (usageRows.results ?? [])) addTotals(usage_cost_30d, r.source, num(r.total));
  for (const it of items) addTotals(projection_30d, it.source, it.projected_monthly_cost);

  const low_stock = items
    .filter((it) => it.status !== 'ok')
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name));

  const recent = (recentRows.results ?? []) as unknown as Movement[];

  return c.json<Summary>({
    stock_value: Math.round(stock_value * 100) / 100,
    stock_value_by_source,
    active_items: items.length,
    spend_month,
    usage_cost_30d,
    projection_30d,
    low_stock,
    out_count: low_stock.filter((i) => i.status === 'habis').length,
    low_count: low_stock.filter((i) => i.status === 'rendah').length,
    recent,
  });
});

// -- Item --------------------------------------------------------------------
api.get('/items', async (c) => {
  const user = c.get('user')!;
  const q = str(c.req.query('q')).toLowerCase();
  const source = str(c.req.query('source'));
  const filter = str(c.req.query('filter')); // low | source

  const [itemRows, stockMap, usage30Map] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM items WHERE archived = 0 ORDER BY name COLLATE NOCASE').all<Item>(),
    stockByItem(c.env.DB),
    usage30ByItem(c.env.DB),
  ]);

  let items: ItemWithStock[] = (itemRows.results ?? []).map((it) =>
    decorate(it, stockMap.get(it.id) ?? 0, usage30Map.get(it.id) ?? 0)
  );

  if (q) {
    const ql = q.toLowerCase();
    items = items.filter((it) => it.name.toLowerCase().includes(ql) || it.category.toLowerCase().includes(ql) || it.id.toLowerCase().includes(ql));
  }
  if (source === 'franchisor' || source === 'local') items = items.filter((it) => it.source === source);
  if (filter === 'low') items = items.filter((it) => it.status !== 'ok');
  items.sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name));

  // Staff menerima versi tanpa kos
  if (user.role !== 'admin') return c.json({ items: items.map((it) => staffItem(it, it.stock)) });
  return c.json({ items });
});

api.get('/items/lookup/:code', async (c) => {
  // Khusus untuk imbasan QR - padanan tepat kod item (bukan carian nama)
  const user = c.get('user')!;
  const code = str(c.req.param('code')).toUpperCase();
  if (!/^SG-[A-Z2-9]{8}$/.test(code)) return jsonError('Kod tidak sah', 404);
  const itemRow = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?1 AND archived = 0').bind(code).first<Item>();
  if (!itemRow) return jsonError('Item tidak dijumpai', 404);
  const [stockMap, usage30Map] = await Promise.all([stockByItem(c.env.DB), usage30ByItem(c.env.DB)]);
  if (user.role !== 'admin') {
    return c.json({ item: staffItem(itemRow, stockMap.get(code) ?? 0) });
  }
  return c.json({ item: decorate(itemRow, stockMap.get(code) ?? 0, usage30Map.get(code) ?? 0) });
});

api.post('/items', adminOnly, async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b) return jsonError('Borang tidak sah');
  const name = str(b.name);
  const source = str(b.source);
  if (!name) return jsonError('Nama item diperlukan');
  if (source !== 'franchisor' && source !== 'local') return jsonError('Sumber item tidak sah');
  const id = genId('SG');
  const item: Item = {
    id,
    name,
    category: str(b.category),
    unit: str(b.unit) || 'unit',
    source,
    unit_cost: Math.max(0, num(b.unit_cost)),
    min_qty: Math.max(0, num(b.min_qty)),
    note: str(b.note),
    created_at: new Date().toISOString(),
  };
  await c.env.DB.prepare(
    `INSERT INTO items (id, name, category, unit, source, unit_cost, min_qty, note, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  ).bind(item.id, item.name, item.category, item.unit, item.source, item.unit_cost, item.min_qty, item.note, item.created_at).run();
  return c.json({ item }, 201);
});

api.put('/items/:id', adminOnly, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => null);
  if (!b) return jsonError('Borang tidak sah');
  const name = str(b.name);
  const source = str(b.source);
  if (!name) return jsonError('Nama item diperlukan');
  if (source !== 'franchisor' && source !== 'local') return jsonError('Sumber item tidak sah');
  const r = await c.env.DB.prepare(
    `UPDATE items SET name = ?2, category = ?3, unit = ?4, source = ?5, unit_cost = ?6, min_qty = ?7, note = ?8
     WHERE id = ?1 AND archived = 0`
  ).bind(id, name, str(b.category), str(b.unit) || 'unit', source, Math.max(0, num(b.unit_cost)), Math.max(0, num(b.min_qty)), str(b.note)).run();
  if (!r.success) return jsonError('Gagal menyimpan item', 500);
  return c.json({ ok: true });
});

api.delete('/items/:id', adminOnly, async (c) => {
  const r = await c.env.DB.prepare('UPDATE items SET archived = 1 WHERE id = ?1').bind(c.req.param('id')).run();
  if (!r.success) return jsonError('Gagal memadam item', 500);
  return c.json({ ok: true });
});

// -- Butiran item (admin sahaja - mengandungi kos & sejarah) -------------------
api.get('/items/:id', adminOnly, async (c) => {
  const id = c.req.param('id');
  const itemRow = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?1 AND archived = 0').bind(id).first<Item>();
  if (!itemRow) return jsonError('Item tidak dijumpai', 404);

  const [stockMap, usage30Map, purchases, usages, adjustments] = await Promise.all([
    stockByItem(c.env.DB),
    usage30ByItem(c.env.DB),
    c.env.DB.prepare('SELECT * FROM purchases WHERE item_id = ?1 ORDER BY date DESC, created_at DESC LIMIT 100').bind(id).all<Purchase>(),
    c.env.DB.prepare('SELECT * FROM usages WHERE item_id = ?1 ORDER BY date DESC, created_at DESC LIMIT 100').bind(id).all<Usage>(),
    c.env.DB.prepare('SELECT * FROM adjustments WHERE item_id = ?1 ORDER BY date DESC, created_at DESC LIMIT 100').bind(id).all<Adjustment>(),
  ]);

  return c.json({
    item: decorate(itemRow, stockMap.get(id) ?? 0, usage30Map.get(id) ?? 0),
    purchases: purchases.results ?? [],
    usages: usages.results ?? [],
    adjustments: adjustments.results ?? [],
  });
});

// -- Pembelian (admin sahaja) --------------------------------------------------
api.get('/purchases', adminOnly, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT p.*, i.name AS item_name, i.unit AS item_unit, i.source AS item_source
     FROM purchases p JOIN items i ON i.id = p.item_id
     WHERE i.archived = 0
     ORDER BY p.date DESC, p.created_at DESC LIMIT 200`
  ).all<Purchase>();
  return c.json({ items: rows.results ?? [] });
});

api.post('/purchases', adminOnly, async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b) return jsonError('Borang tidak sah');
  const item_id = str(b.item_id);
  const qty = num(b.qty);
  const unit_cost = num(b.unit_cost);
  if (!item_id) return jsonError('Item diperlukan');
  if (qty <= 0) return jsonError('Kuantiti mesti melebihi sifar');
  if (unit_cost <= 0) return jsonError('Kos seunit mesti lebih daripada sifar');

  const item = await c.env.DB.prepare('SELECT id FROM items WHERE id = ?1 AND archived = 0').bind(item_id).first();
  if (!item) return jsonError('Item tidak dijumpai', 404);

  const id = genId('PC');
  const r = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO purchases (id, item_id, qty, unit_cost, date, note, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    ).bind(id, item_id, qty, unit_cost, str(b.date) || today(), str(b.note), new Date().toISOString()),
    // Kos seunit item dikemas kini mengikut pembelian terkini
    c.env.DB.prepare('UPDATE items SET unit_cost = ?2 WHERE id = ?1').bind(item_id, unit_cost),
  ]);
  if (!r.every((x) => x.success)) return jsonError('Gagal merekod pembelian', 500);
  return c.json({ id }, 201);
});

api.delete('/purchases/:id', adminOnly, async (c) => {
  const old = await c.env.DB.prepare(
    'SELECT item_id, date, created_at FROM purchases WHERE id = ?1'
  ).bind(c.req.param('id')).first<{ item_id: string; date: string; created_at: string }>();
  const r = await c.env.DB.prepare('DELETE FROM purchases WHERE id = ?1').bind(c.req.param('id')).run();
  if (!r.success) return jsonError('Gagal membatalkan pembelian', 500);
  // Pulihkan kos seunit item daripada pembelian terkini yang masih ada,
  // tetapi hanya jika pembelian yang dipadam adalah sumber kos terkini
  if (old) {
    const latest = await c.env.DB.prepare(
      'SELECT unit_cost, date, created_at FROM purchases WHERE item_id = ?1 ORDER BY date DESC, created_at DESC LIMIT 1'
    ).bind(old.item_id).first<{ unit_cost: number; date: string; created_at: string }>();
    if (latest && (latest.date < old.date || (latest.date === old.date && latest.created_at <= old.created_at))) {
      await c.env.DB.prepare('UPDATE items SET unit_cost = ?2 WHERE id = ?1').bind(old.item_id, latest.unit_cost).run();
    }
  }
  return c.json({ ok: true });
});

// -- Penggunaan --------------------------------------------------------------
api.post('/usages', requireAuth, async (c) => {
  const user = c.get('user')!;
  const b = await c.req.json().catch(() => null);
  if (!b) return jsonError('Borang tidak sah');
  const item_id = str(b.item_id);
  const qty = num(b.qty);
  if (!item_id) return jsonError('Item diperlukan');
  if (qty <= 0) return jsonError('Kuantiti mesti melebihi sifar');
  const method = str(b.method) === 'scan' ? 'scan' : 'manual';

  const item = await c.env.DB.prepare('SELECT id, unit, unit_cost FROM items WHERE id = ?1 AND archived = 0').bind(item_id).first<{ id: string; unit: string; unit_cost: number }>();
  if (!item) return jsonError('Item tidak dijumpai', 404);

  // Stok tidak dibenarkan negatif: penggunaan mesti berpandukan baki semasa
  const srow = await c.env.DB.prepare(
    `SELECT COALESCE((SELECT SUM(qty) FROM purchases WHERE item_id = ?1), 0)
          - COALESCE((SELECT SUM(qty) FROM usages WHERE item_id = ?1), 0)
          + COALESCE((SELECT SUM(delta) FROM adjustments WHERE item_id = ?1), 0) AS stock`
  ).bind(item_id).first<{ stock: number }>();
  const stock = num(srow?.stock);
  if (qty > stock) {
    return jsonError(`Stok tidak mencukupi: baki ${stock} ${item.unit}. Laraskan stok dahulu jika kiraan fizikal berbeza`);
  }

  const id = genId('US');
  await c.env.DB.prepare(
    `INSERT INTO usages (id, item_id, qty, unit_cost, date, method, note, created_at, recorded_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  ).bind(id, item_id, qty, item.unit_cost, str(b.date) || today(), method, str(b.note), new Date().toISOString(), user.id).run();
  return c.json({ id }, 201);
});

api.delete('/usages/:id', adminOnly, async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM usages WHERE id = ?1').bind(c.req.param('id')).run();
  if (!r.success) return jsonError('Gagal membatalkan rekod', 500);
  return c.json({ ok: true });
});

// -- Pelarasan stok (admin sahaja) ---------------------------------------------
api.post('/adjustments', adminOnly, async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b) return jsonError('Borang tidak sah');
  const item_id = str(b.item_id);
  const delta = num(b.delta);
  if (!item_id) return jsonError('Item diperlukan');
  if (delta === 0) return jsonError('Nilai pelarasan tidak boleh sifar');

  const item = await c.env.DB.prepare('SELECT id, unit FROM items WHERE id = ?1 AND archived = 0').bind(item_id).first<{ id: string; unit: string }>();
  if (!item) return jsonError('Item tidak dijumpai', 404);

  // Pelarasan juga tidak boleh menjadikan stok negatif
  const srow = await c.env.DB.prepare(
    `SELECT COALESCE((SELECT SUM(qty) FROM purchases WHERE item_id = ?1), 0)
          - COALESCE((SELECT SUM(qty) FROM usages WHERE item_id = ?1), 0)
          + COALESCE((SELECT SUM(delta) FROM adjustments WHERE item_id = ?1), 0) AS stock`
  ).bind(item_id).first<{ stock: number }>();
  const stock = num(srow?.stock);
  if (stock + delta < 0) {
    return jsonError(`Pelarasan akan menjadikan stok negatif (baki ${stock} ${item.unit})`);
  }

  const id = genId('AD');
  await c.env.DB.prepare(
    `INSERT INTO adjustments (id, item_id, delta, date, reason, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(id, item_id, delta, str(b.date) || today(), str(b.reason), new Date().toISOString()).run();
  return c.json({ id }, 201);
});

api.delete('/adjustments/:id', adminOnly, async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM adjustments WHERE id = ?1').bind(c.req.param('id')).run();
  if (!r.success) return jsonError('Gagal membatalkan pelarasan', 500);
  return c.json({ ok: true });
});

// -- Laporan (admin sahaja) ----------------------------------------------------
api.get('/reports', adminOnly, async (c) => {
  const months = Math.min(24, Math.max(1, num(c.req.query('months'), 6)));
  const start = klNow();
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  const startYm = start.toISOString().slice(0, 7);
  const since30 = new Date(Date.now() + KL_OFFSET_MS - 30 * 86400_000).toISOString().slice(0, 10);

  const [spendRows, usageRows, topRows, itemRows, stockMap, usage30Map, staffRows, adjRows, catSpendRows, catUsageRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT substr(p.date, 1, 7) AS ym, i.source AS source, SUM(p.qty * p.unit_cost) AS total
       FROM purchases p JOIN items i ON i.id = p.item_id
       WHERE substr(p.date, 1, 7) >= ?1 GROUP BY ym, i.source`
    ).bind(startYm).all<{ ym: string; source: string; total: number }>(),
    c.env.DB.prepare(
      `SELECT substr(u.date, 1, 7) AS ym, i.source AS source, SUM(u.qty * u.unit_cost) AS total
       FROM usages u JOIN items i ON i.id = u.item_id
       WHERE substr(u.date, 1, 7) >= ?1 GROUP BY ym, i.source`
    ).bind(startYm).all<{ ym: string; source: string; total: number }>(),
    c.env.DB.prepare(
      `SELECT u.item_id, i.name, i.unit, i.source, SUM(u.qty) AS qty, SUM(u.qty * u.unit_cost) AS cost
       FROM usages u JOIN items i ON i.id = u.item_id
       WHERE u.date >= ?1 GROUP BY u.item_id ORDER BY cost DESC LIMIT 6`
    ).bind(since30).all<{ item_id: string; name: string; unit: string; source: string; qty: number; cost: number }>(),
    c.env.DB.prepare('SELECT * FROM items WHERE archived = 0').all<Item>(),
    stockByItem(c.env.DB),
    usage30ByItem(c.env.DB),
    c.env.DB.prepare(
      `SELECT u2.full_name AS user_name, COUNT(*) AS count, SUM(u.qty) AS qty, SUM(u.qty * u.unit_cost) AS cost
       FROM usages u JOIN items i ON i.id = u.item_id LEFT JOIN users u2 ON u2.id = u.recorded_by
       WHERE u.date >= ?1 GROUP BY u.recorded_by ORDER BY cost DESC`
    ).bind(since30).all<{ user_name: string | null; count: number; qty: number; cost: number }>(),
    c.env.DB.prepare(
      `SELECT a.id, a.date, a.reason, a.delta, i.name AS item_name, i.unit, i.unit_cost
       FROM adjustments a JOIN items i ON i.id = a.item_id
       WHERE substr(a.date, 1, 7) >= ?1 ORDER BY a.date DESC, a.created_at DESC LIMIT 100`
    ).bind(startYm).all<{ id: string; date: string; reason: string; delta: number; item_name: string; unit: string; unit_cost: number }>(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(i.category, ''), 'Lain-lain') AS category, SUM(p.qty * p.unit_cost) AS total
       FROM purchases p JOIN items i ON i.id = p.item_id
       WHERE substr(p.date, 1, 7) >= ?1 GROUP BY category ORDER BY total DESC`
    ).bind(startYm).all<{ category: string; total: number }>(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(i.category, ''), 'Lain-lain') AS category, SUM(u.qty * u.unit_cost) AS total
       FROM usages u JOIN items i ON i.id = u.item_id
       WHERE substr(u.date, 1, 7) >= ?1 GROUP BY category ORDER BY total DESC`
    ).bind(startYm).all<{ category: string; total: number }>(),
  ]);

  // Kumpulkan bulan berturutan
  const yms: string[] = [];
  const cursor = new Date(start);
  for (let m = 0; m < months; m++) {
    yms.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const monthMap = new Map<string, MonthRow>(yms.map((ym) => [ym, { ym, spend_franchisor: 0, spend_local: 0, usage_franchisor: 0, usage_local: 0 }]));
  for (const r of spendRows.results ?? []) {
    const row = monthMap.get(r.ym);
    if (row) {
      if (r.source === 'franchisor') row.spend_franchisor += num(r.total);
      else row.spend_local += num(r.total);
    }
  }
  for (const r of usageRows.results ?? []) {
    const row = monthMap.get(r.ym);
    if (row) {
      if (r.source === 'franchisor') row.usage_franchisor += num(r.total);
      else row.usage_local += num(r.total);
    }
  }

  const items: ItemWithStock[] = (itemRows.results ?? [])
    .map((it) => decorate(it, stockMap.get(it.id) ?? 0, usage30Map.get(it.id) ?? 0))
    .sort((a, b) => b.projected_monthly_cost - a.projected_monthly_cost);

  // Pecahan kategori (gabungkan belanja + penggunaan)
  const catMap = new Map<string, CategoryRow>();
  for (const r of catSpendRows.results ?? []) catMap.set(r.category, { category: r.category, spend: num(r.total), usage_cost: 0 });
  for (const r of catUsageRows.results ?? []) {
    const row = catMap.get(r.category) ?? { category: r.category, spend: 0, usage_cost: 0 };
    row.usage_cost = num(r.total);
    catMap.set(r.category, row);
  }

  return c.json<Reports>({
    months: yms.map((ym) => {
      const r = monthMap.get(ym)!;
      for (const k of ['spend_franchisor', 'spend_local', 'usage_franchisor', 'usage_local'] as const) r[k] = Math.round(r[k] * 100) / 100;
      return r;
    }),
    top_usage: (topRows.results ?? []).map((r) => ({ ...r, source: (r.source === 'franchisor' ? 'franchisor' : 'local') as Source })),
    items,
    staff_usage: (staffRows.results ?? []).map((r) => ({
      user_name: r.user_name,
      count: num(r.count),
      qty: num(r.qty),
      cost: Math.round(num(r.cost) * 100) / 100,
    })),
    adjustments: (adjRows.results ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      reason: r.reason,
      delta: num(r.delta),
      item_name: r.item_name,
      unit: r.unit,
      value: Math.round(num(r.delta) * num(r.unit_cost) * 100) / 100,
    })),
    by_category: [...catMap.values()]
      .map((r) => ({ category: r.category, spend: Math.round(r.spend * 100) / 100, usage_cost: Math.round(r.usage_cost * 100) / 100 }))
      .sort((a, b) => b.spend + b.usage_cost - (a.spend + a.usage_cost)),
  });
});

// ---------------------------------------------------------------- static + routing

app.route('/api', api);
app.use('*', async (c) => {
  // Sandarkan respons API generik jika laluan API tidak dijumpai
  if (c.req.path.startsWith('/api/')) return jsonError('Laluan tidak dijumpai', 404);
  return c.env.ASSETS.fetch(c.req.raw as unknown as Parameters<Fetcher['fetch']>[0]);
});

export default app;
