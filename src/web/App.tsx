import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Boxes, Coffee, Home, LogOut, ScanLine, ShoppingCart, Users } from 'lucide-react';
import { Toaster, Spinner } from './ui';
import { api } from './api';
import { AuthProvider, useAuth, isAdmin, type SessionUser } from './auth';
import type { AuthMe, User } from '../shared/types';
import Dashboard from './pages/Dashboard';
import StaffDashboard from './pages/StaffDashboard';
import Inventory from './pages/Inventory';
import ScanPage from './pages/ScanPage';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Labels from './pages/Labels';
import LabelSheet from './pages/LabelSheet';
import UsersPage from './pages/UsersPage';
import UserQr from './pages/UserQr';
import LoginPage from './pages/LoginPage';

// ------------------------------------------------------------------ penghala hash mudah

export function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string) {
  window.location.hash = path;
}

// ------------------------------------------------------------------ navigasi

const NAV: { path: string; label: string; icon: typeof Home; center?: boolean; admin?: boolean }[] = [
  { path: '/', label: 'Utama', icon: Home },
  { path: '/inventori', label: 'Inventori', icon: Boxes, admin: true },
  { path: '/imbas', label: 'Imbas', icon: ScanLine, center: true },
  { path: '/pembelian', label: 'Pembelian', icon: ShoppingCart, admin: true },
  { path: '/laporan', label: 'Laporan', icon: BarChart3, admin: true },
  { path: '/pengguna', label: 'Pengguna', icon: Users, admin: true },
];

function navFor(user: SessionUser) {
  const admin = isAdmin(user);
  return admin ? NAV : NAV.filter((n) => !n.admin);
}

function Sidebar({ route }: { route: string }) {
  const { user, setUser } = useAuth();
  const items = navFor(user);

  async function logout() {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // kuki tetap dibersihkan oleh pelayan
    }
    setUser(null);
    window.location.hash = '/';
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-bark-900 px-4 py-6 md:flex no-print">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="rounded-xl bg-coffee-500 p-2 text-cream-50">
          <Coffee size={22} />
        </div>
        <div>
          <div className="font-bold text-cream-50">Saigon Inventori</div>
          <div className="text-xs text-cream-50/50">Kedai kopi anda</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {items.filter((n) => !n.center).map((n) => (
          <a
            key={n.path}
            href={`#${n.path}`}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${
              route === n.path ? 'bg-cream-50/10 text-cream-50' : 'text-cream-50/55 hover:bg-cream-50/5 hover:text-cream-50'
            }`}
          >
            <n.icon size={19} />
            {n.label}
          </a>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-xl bg-cream-50/5 px-3 py-3">
          <div className="truncate text-sm font-semibold text-cream-50">{user?.full_name}</div>
          <div className="truncate text-[11px] text-cream-50/50">
            {user?.position ? `${user.position} · ` : ''}{isAdmin(user) ? 'Admin' : 'Staff'}
          </div>
          <button onClick={logout} className="mt-2.5 flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-cream-50/60 transition-colors hover:bg-cream-50/10 hover:text-cream-50">
            <LogOut size={14} /> Log Keluar
          </button>
        </div>
        <div className="px-2 text-[11px] leading-relaxed text-cream-50/35">
          Data tersimpan dalam Cloudflare D1
        </div>
      </div>
    </aside>
  );
}

function BottomNav({ route }: { route: string }) {
  const { user } = useAuth();
  // 'Pengguna' hanya di sidebar (elak nav bawah terlalu sesak)
  const items = navFor(user).filter((n) => n.path !== '/pengguna');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur md:hidden no-print pb-safe">
      <div className={`mx-auto grid max-w-lg ${items.length <= 2 ? 'grid-cols-2' : 'grid-cols-5'}`}>
        {items.map((n) =>
          n.center ? (
            <a key={n.path} href={`#${n.path}`} className="relative flex items-center justify-center" aria-label={n.label}>
              <span
                className={`-mt-5 flex h-14 w-14 items-center justify-center rounded-full text-cream-50 shadow-lg transition-colors ${
                  route === n.path ? 'bg-coffee-500' : 'bg-bark-800'
                }`}
              >
                <n.icon size={24} />
              </span>
            </a>
          ) : (
            <a
              key={n.path}
              href={`#${n.path}`}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                route === n.path ? 'text-coffee-500' : 'text-bark-700/50'
              }`}
            >
              <n.icon size={21} strokeWidth={route === n.path ? 2.4 : 2} />
              {n.label}
            </a>
          )
        )}
      </div>
    </nav>
  );
}

// ------------------------------------------------------------------ App

export default function App() {
  const route = useRoute();
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadMe() {
    setLoadError(null);
    try {
      const m = await api.get<AuthMe>('/api/auth/me');
      if (m.user) localStorage.setItem('me', JSON.stringify(m.user));
      setMe(m);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Ralat');
    }
  }
  useEffect(() => { void loadMe(); }, []);

  function handleLogin(u: User) {
    localStorage.setItem('me', JSON.stringify(u));
    setMe({ user: u, needs_setup: false });
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-berry-600">{loadError}</p>
          <button onClick={loadMe} className="mt-3 rounded-xl bg-bark-800 px-4 py-2.5 text-sm font-semibold text-cream-50">Cuba Semula</button>
        </div>
      </div>
    );
  }

  if (!me) {
    return <div className="flex min-h-screen items-center justify-center bg-cream-100"><Spinner /></div>;
  }

  const base = route.split('?')[0];

  // Layar log masuk / persediaan
  if (me.needs_setup || !me.user) {
    return (
      <>
        <LoginPage me={me} onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  // Halaman cetak kod QR pengguna (di luar kerangka biasa)
  if (base === '/cetak-qr-pengguna') {
    return (
      <div className="min-h-screen md:pl-64 print-reset">
        <Sidebar route={base} />
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
          <UserQr />
        </main>
        <Toaster />
      </div>
    );
  }

  const admin = isAdmin(me.user);
  const labelMatch = base.match(/^\/label\/(.+)$/);

  let page: ReactNode;
  if (base === '/label') {
    page = <LabelSheet />;
  } else if (labelMatch) {
    page = <Labels itemId={decodeURIComponent(labelMatch[1])} />;
  } else {
    switch (base) {
      case '/inventori':
        page = <Inventory />;
        break;
      case '/imbas':
        page = <ScanPage />;
        break;
      case '/pembelian':
        page = <Purchases />;
        break;
      case '/laporan':
        page = <Reports />;
        break;
      case '/pengguna':
        page = admin ? <UsersPage /> : <Denied />;
        break;
      default:
        // Halaman utama: admin → dashboard penuh, staff → dashboard sendiri
        page = admin ? <Dashboard /> : <StaffDashboard />;
    }
  }

  const items = navFor(me.user);
  const known = items.find((n) => n.path === base);
  const title = labelMatch
    ? 'Label Kod QR'
    : base === '/label'
      ? 'Cetak Label Pukal'
      : base === '/pengguna' && admin
        ? 'Pengguna'
        : base === '/cetak-qr-pengguna'
          ? 'Cetak QR Pengguna'
          : known?.label ?? (admin ? 'Utama' : 'Imbas');

  return (
    <AuthProvider user={me.user} setUser={(u) => setMe({ user: u, needs_setup: false })}>
      <div className="min-h-screen md:pl-64 print-reset">
        <Sidebar route={base} />
        <BottomNav route={base} />

        {/* Bar atas mudah alih */}
        <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-cream-200 bg-cream-100/90 px-4 py-3 backdrop-blur md:hidden no-print">
          <div className="rounded-lg bg-bark-800 p-1.5 text-cream-50">
            <Coffee size={16} />
          </div>
          <span className="text-base font-bold text-bark-900">{title}</span>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">{page}</main>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

function Denied() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="rounded-xl bg-berry-soft p-3 text-berry-600"><Users size={24} /></div>
      <h2 className="text-lg font-bold text-bark-900">Tiada kebenaran</h2>
      <p className="text-sm text-bark-700/60">Halaman ini hanya untuk admin.</p>
      <button onClick={() => navigate('/')} className="rounded-xl bg-bark-800 px-4 py-2.5 text-sm font-semibold text-cream-50">Ke Utama</button>
    </div>
  );
}
