import { useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CameraOff, KeyRound, LogIn, ScanLine } from 'lucide-react';
import { api } from '../api';
import { Button, Field, inputCls, Modal, Segmented, Spinner, toast } from '../ui';
import type { AuthMe, User } from '../../shared/types';

// ------------------------------------------------------------------ borang akaun pertama

function SetupForm({ onDone }: { onDone: (u: User) => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [position, setPosition] = useState('Pemilik');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (password.length < 8) {
      toast('Kata laluan mesti sekurang-kurangnya 8 aksara', 'error');
      return;
    }
    if (password !== confirm) {
      toast('Kata laluan tidak sepadan', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ user: User; qr_code: string }>('/api/auth/setup', {
        full_name: fullName,
        username,
        position,
        password,
        token,
      });
      toast(`Akaun admin dicipta. Kod QR log masuk: ${res.qr_code} (tidak boleh dilihat semula; boleh dijana semula di menu Pengguna)`, 'success');
      onDone(res.user);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Nama Penuh">
        <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
      </Field>
      <Field label="Nama Pengguna" hint="3-32 aksara: huruf kecil, nombor, titik, garis bawah atau sempang">
        <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
      </Field>
      <Field label="Jawatan">
        <input className={inputCls} value={position} onChange={(e) => setPosition(e.target.value)} />
      </Field>
      <Field label="Kata Laluan" hint="Sekurang-kurangnya 8 aksara">
        <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Sahkan Kata Laluan">
        <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Field label="Token Persediaan (jika ditetapkan)">
        <input className={inputCls} value={token} onChange={(e) => setToken(e.target.value)} autoCapitalize="none" />
      </Field>
      <Button full onClick={submit} disabled={saving || !fullName || !username || !password}>
        {saving ? <Spinner small /> : <><LogIn size={17} /> Cipta Akaun Admin</>}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ log masuk QR

function QrLogin({ onDone }: { onDone: (u: User) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const busy = useRef(false);

  const tryLogin = useCallback(async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await api.post<{ user: User }>('/api/auth/qr-login', { code: code.trim().toUpperCase() });
      navigator.vibrate?.(80);
      onDone(res.user);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kod QR tidak sah', 'error');
    } finally {
      busy.current = false;
    }
  }, [onDone]);

  const onScan = useCallback((text: string) => {
    // 8 aksara = kod lama, 12 aksara = kod baharu
    const m = text.match(/USR-[A-Z2-9]{8}(?:[A-Z2-9]{4})?/i);
    if (m) void tryLogin(m[0]);
  }, [tryLogin]);

  useEffect(() => {
    let cancelled = false;
    let scanner: QrScanner | null = null;
    async function start() {
      if (!videoRef.current) return;
      if (!('mediaDevices' in navigator) || !window.isSecureContext) {
        setCameraOk(false);
        return;
      }
      try {
        scanner = new QrScanner(videoRef.current, (r) => onScan(r.data ?? r), {
          preferredCamera: 'environment',
          maxScansPerSecond: 4,
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setCameraOk(true);
      } catch {
        if (!cancelled) setCameraOk(false);
      }
    }
    void start();
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [onScan]);

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-bark-700/70">Imbas kod QR log masuk peribadi anda (dicetak oleh admin).</p>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-bark-950 aspect-square shadow-lg">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {cameraOk === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream-50/70">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-cream-50/20 border-t-caramel-400" />
            <span className="text-sm">Menghidupkan kamera…</span>
          </div>
        )}
        {cameraOk === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-cream-50/80">
            <CameraOff size={34} />
            <span className="text-sm font-semibold">Kamera tidak tersedia</span>
            <span className="text-xs text-cream-50/60">Beri kebenaran kamera pada pelayar, atau log masuk dengan kata laluan.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ halaman

export default function LoginPage({ me, onLogin }: { me: AuthMe; onLogin: (u: User) => void }) {
  const [tab, setTab] = useState<'password' | 'qr'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function login() {
    setSaving(true);
    try {
      const res = await api.post<{ user: User }>('/api/auth/login', { username, password });
      onLogin(res.user);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo.svg" alt="Logo Kopi Saigon" className="h-16 w-16" />
          <div>
            <h1 className="text-2xl font-extrabold text-bark-900">Kopi Saigon Keningau</h1>
            <p className="text-sm text-bark-700/60">Tiada Hari Tanpa Kopi</p>
          </div>
        </div>

        {me.needs_setup ? (
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-1 text-lg font-bold text-bark-900">Persediaan Pertama</h2>
            <p className="mb-5 text-sm text-bark-700/60">
              Tiada akaun lagi. Cipta akaun <b>admin</b> pertama. Anda akan menguruskan akaun staff selepas itu.
            </p>
            <SetupForm onDone={onLogin} />
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <Segmented
              value={tab}
              onChange={(v) => setTab(v)}
              options={[
                { value: 'password', label: 'Kata Laluan' },
                { value: 'qr', label: 'Imbas QR' },
              ]}
            />
            <div className="mt-5">
              {tab === 'password' ? (
                <div className="space-y-4">
                  <Field label="Nama Pengguna">
                    <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoFocus />
                  </Field>
                  <Field label="Kata Laluan">
                    <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <Button full onClick={login} disabled={saving || !username || !password}>
                    {saving ? <Spinner small /> : <><KeyRound size={17} /> Log Masuk</>}
                  </Button>
                </div>
              ) : (
                <QrLogin onDone={onLogin} />
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-bark-700/50">
          Data tersimpan dalam Cloudflare D1 · Sesi log masuk sah 30 hari
        </p>
      </div>
    </div>
  );
}
