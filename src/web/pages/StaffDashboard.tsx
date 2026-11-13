import { AlertTriangle, PackageMinus, RefreshCw, ScanLine } from 'lucide-react';
import { useApi, api } from '../api';
import { angka, labelStatus } from '../format';
import { Button, Card, EmptyState, SectionTitle, Spinner } from '../ui';
import { useAuth } from '../auth';
import { navigate } from '../App';
import type { StaffHome } from '../../shared/types';

export default function StaffDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<StaffHome>('/api/staff/home');

  const hour = new Date(Date.now() + 8 * 3600_000).getUTCHours(); // waktu Kuala Lumpur
  const ucapan = hour < 12 ? 'Selamat pagi' : hour < 18 ? 'Selamat tengah hari' : 'Selamat petang';

  return (
    <div className="space-y-5">
      {/* Salam + butang imbas */}
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-bark-900 px-6 py-8 text-center text-cream-50">
        <div className="text-sm text-cream-50/60">{ucapan},</div>
        <h1 className="text-2xl font-extrabold">{user?.full_name ?? 'Staff'}</h1>
        <button
          onClick={() => navigate('/imbas')}
          className="mt-1 flex min-h-14 w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-coffee-500 px-6 text-lg font-bold transition-colors hover:bg-coffee-400"
        >
          <ScanLine size={24} /> Imbas Stok Keluar
        </button>
        <p className="text-xs text-cream-50/50">Imbas kod QR pada bekas item untuk merekod pengeluaran</p>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-berry-600">{error}</span>
          <Button variant="secondary" onClick={reload}><RefreshCw size={15} /> Cuba Semula</Button>
        </Card>
      ) : data ? (
        <>
          {/* Pengeluaran saya hari ini */}
          <div>
            <SectionTitle>Pengeluaran Saya Hari Ini</SectionTitle>
            {data.my_usage_today.length === 0 ? (
              <Card className="px-5 py-4 text-sm text-bark-700/60">Belum ada pengeluaran direkod hari ini.</Card>
            ) : (
              <Card className="divide-y divide-cream-100">
                {data.my_usage_today.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-cream-100 text-coffee-500">
                      <PackageMinus size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-bark-900">{u.item_name}</span>
                    <span className="num text-sm font-bold text-bark-800">−{angka(u.qty)} {u.unit}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* Perlu dipesan */}
          <div>
            <SectionTitle>Perlu Dipesan</SectionTitle>
            {data.need_reorder.length === 0 ? (
              <EmptyState icon={<AlertTriangle size={22} />} title="Semua stok cukup" message="Tiada item yang perlu dipesan buat masa ini." />
            ) : (
              <Card className="divide-y divide-cream-100">
                {data.need_reorder.map((it) => {
                  const st = labelStatus(it.status);
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-bark-900">{it.name}</span>
                        <span className="num block text-xs text-bark-700/60">
                          Ada {angka(Math.max(0, it.stock))} {it.unit}{it.min_qty > 0 ? ` · minimum ${angka(it.min_qty)}` : ''}
                        </span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>

          <p className="text-center text-xs text-bark-700/50">{data.total_items} item dalam inventori · Laporan perbelanjaan hanya untuk admin</p>
        </>
      ) : null}
    </div>
  );
}
