import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Boxes, Coffee, Home, ScanLine, ShoppingCart } from 'lucide-react';
import { Toaster } from './ui';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ScanPage from './pages/ScanPage';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Labels from './pages/Labels';
import LabelSheet from './pages/LabelSheet';

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

const NAV: { path: string; label: string; icon: typeof Home; center?: boolean }[] = [
  { path: '/', label: 'Utama', icon: Home },
  { path: '/inventori', label: 'Inventori', icon: Boxes },
  { path: '/imbas', label: 'Imbas', icon: ScanLine, center: true },
  { path: '/pembelian', label: 'Pembelian', icon: ShoppingCart },
  { path: '/laporan', label: 'Laporan', icon: BarChart3 },
];

function Sidebar({ route }: { route: string }) {
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
        {NAV.filter((n) => !n.center).map((n) => (
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
      <div className="mt-auto px-2 text-[11px] leading-relaxed text-cream-50/35">
        Data tersimpan dalam Cloudflare D1
      </div>
    </aside>
  );
}

function BottomNav({ route }: { route: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur md:hidden no-print pb-safe">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.map((n) =>
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

  const base = route.split('?')[0];
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
      default:
        page = <Dashboard />;
    }
  }

  const title = labelMatch ? 'Label Kod QR' : base === '/label' ? 'Cetak Label Pukal' : NAV.find((n) => n.path === base)?.label ?? 'Utama';

  return (
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
  );
}
