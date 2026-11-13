import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Boxes, Home, ScanLine, ShoppingCart, UserRound, Users } from 'lucide-react';
import { Toaster, Spinner } from './ui';
import { api } from './api';
import { AuthProvider, useAuth, isAdmin, type SessionUser } from './auth';
import type { AuthMe, User } from '../shared/types';
import AccountModal from './pages/AccountModal';
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

function Sidebar({ route, onAccount }: { route: string; onAccount: () => void }) {
  const { user } = useAuth();
  const items = navFor(user);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-bark-900 px-4 py-6 md:flex no-print">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="rounded-xl bg-cream-100 p-1.5">
          <img src="/logo.svg" alt="" className="h-9 w-9" />
        </div>
        <div>
          <div className="font-bold text-cream-50">Kopi Saigon Keningau</div>
          <div className="text-xs text-cream-50/50">Tiada Hari Tanpa Kopi</div>
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
          <button onClick={onAccount} className="mt-2.5 flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-cream-50/60 transition-colors hover:bg-cream-50/10 hover:text-cream-50">
            <UserRound size={14} /> Akaun &amp; Log Keluar
          </button>
        </div>
        <div className="px-2 text-[11px] leading-relaxed text-cream-50/35">
          The Dotters
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

// ------------------------------------------------------------------ bar atas mudah alih

/** Bar atas telefon: jenama + ikon Pengguna (admin) + Akaun */
function MobileHeader({ onAccount }: { onAccount: () => void }) {
  const { user } = useAuth();
  const admin = isAdmin(user);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-cream-200 bg-cream-100/90 px-4 py-2.5 backdrop-blur md:hidden no-print">
      <img src="/logo.svg" alt="" className="h-8 w-8" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[15px] font-extrabold text-bark-900">Kopi Saigon Keningau</div>
        <div className="truncate text-[10px] text-bark-700/55">Tiada Hari Tanpa Kopi</div>
      </div>
      <span className="flex items-center gap-1">
        {admin && (
          <button
            onClick={() => navigate('/pengguna')}
            className="flex h-10 w-10 items-center justify-center text-bark-700/70 transition-colors hover:text-bark-900"
            aria-label="Pengguna"
          >
            <Users size={20} />
          </button>
        )}
        <button
          onClick={onAccount}
          className="flex h-10 w-10 items-center justify-center text-bark-700/70 transition-colors hover:text-bark-900"
          aria-label="Akaun"
        >
          <UserRound size={20} />
        </button>
      </span>
    </header>
  );
}

// ------------------------------------------------------------------ App

export default function App() {
  const route = useRoute();
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

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

  // Sesi dibatalkan/dilumpuhkan di tempat lain: kembali ke skrin log masuk
  useEffect(() => {
    const onUnauth = () => {
      localStorage.removeItem('me');
      setMe({ user: null, needs_setup: false });
    };
    window.addEventListener('sg:unauthorized', onUnauth);
    return () => window.removeEventListener('sg:unauthorized', onUnauth);
  }, []);

  function handleLogin(u: User) {
    localStorage.setItem('me', JSON.stringify(u));
    setAccountOpen(false); // jangan warisi modal terbuka daripada skrin log masuk
    setMe({ user: u, needs_setup: false });
    // Selepas log masuk sentiasa ke dashboard, bukan halaman terakhir
    if (window.location.hash !== '#/') window.location.hash = '/';
    else window.scrollTo({ top: 0 });
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
      <AuthProvider user={me.user} setUser={(u) => setMe({ user: u, needs_setup: false })}>
        <div className="min-h-screen md:pl-64 print-reset">
          <Sidebar route={base} onAccount={() => setAccountOpen(true)} />
          <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <UserQr />
          </main>
          <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
          <Toaster />
        </div>
      </AuthProvider>
    );
  }

  const admin = isAdmin(me.user);
  const labelMatch = base.match(/^\/label\/(.+)$/);

  let page: ReactNode;
  if (base === '/label') {
    page = admin ? <LabelSheet /> : <Denied />;
  } else if (labelMatch) {
    let itemId: string | null = null;
    try {
      itemId = decodeURIComponent(labelMatch[1]);
    } catch {
      itemId = null; // peratusan tidak sah dalam URL
    }
    page = !admin ? <Denied /> : itemId ? <Labels itemId={itemId} /> : <p className="text-sm text-bark-700/60">Pautan label tidak sah.</p>;
  } else {
    switch (base) {
      case '/inventori':
        page = admin ? <Inventory /> : <Denied />;
        break;
      case '/imbas':
        page = <ScanPage />;
        break;
      case '/pembelian':
        page = admin ? <Purchases /> : <Denied />;
        break;
      case '/laporan':
        page = admin ? <Reports /> : <Denied />;
        break;
      case '/pengguna':
        page = admin ? <UsersPage /> : <Denied />;
        break;
      default:
        // Halaman utama: admin → dashboard penuh, staff → dashboard sendiri
        page = admin ? <Dashboard /> : <StaffDashboard />;
    }
  }

  return (
    <AuthProvider user={me.user} setUser={(u) => setMe({ user: u, needs_setup: false })}>
      <div className="min-h-screen md:pl-64 print-reset">
        <Sidebar route={base} onAccount={() => setAccountOpen(true)} />
        <BottomNav route={base} />

        {/* Bar atas mudah alih - jenama + akses Pengguna (admin) + Akaun */}
        <MobileHeader onAccount={() => setAccountOpen(true)} />

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">{page}</main>
        <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
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
