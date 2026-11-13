import { Link } from './link';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, ChevronRight, SlidersHorizontal, TrendingUp, Wallet } from 'lucide-react';
import { useApi } from '../api';
import { angka, hariBerbaki, labelStatus, rm, rmShort, SOURCE_LABEL, tarikh } from '../format';
import { SourceBar } from '../chart';
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from '../ui';
import type { Movement, Summary } from '../../shared/types';

const movementIcon = {
  purchase: { icon: ArrowDownCircle, cls: 'text-leaf-600 bg-leaf-100', label: 'Masuk' },
  usage: { icon: ArrowUpCircle, cls: 'text-coffee-500 bg-cream-200', label: 'Keluar' },
  adjustment: { icon: SlidersHorizontal, cls: 'text-bark-700 bg-cream-200', label: 'Laras' },
} as const;

function MovementRow({ m }: { m: Movement }) {
  const info = movementIcon[m.kind];
  return (
    <Link href="/inventori" className="flex items-center gap-3 px-4 py-3 hover:bg-cream-100/60">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${info.cls}`}>
        <info.icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-bark-900">{m.item_name}</div>
        <div className="text-xs text-bark-700/60">
          {tarikh(m.date)} · {info.label}
          {m.kind === 'purchase' && m.unit_cost !== null ? ` @ ${rm(m.unit_cost)}` : ''}
          {m.note ? ` · ${m.note}` : ''}
        </div>
      </div>
      <span className={`num shrink-0 text-sm font-bold ${m.kind === 'usage' || m.qty < 0 ? 'text-berry-600' : 'text-leaf-600'}`}>
        {m.kind === 'adjustment' && m.qty > 0 ? '+' : ''}
        {angka(m.qty)} {m.item_unit}
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<Summary>('/api/summary');

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} reload={reload} />;
  if (!data) return null;

  const spendTotal = data.spend_month.franchisor + data.spend_month.local;
  const projectionTotal = data.projection_30d.franchisor + data.projection_30d.local;

  return (
    <div className="space-y-6">
      {/* Kad ringkasan */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-bark-700/60">
            <Boxes size={14} /> NILAI STOK
          </div>
          <div className="num mt-2 text-xl font-extrabold text-bark-900 md:text-2xl">{rmShort(data.stock_value)}</div>
          <div className="mt-0.5 text-xs text-bark-700/60">{data.active_items} item aktif</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-bark-700/60">
            <Wallet size={14} /> BELANJA BULAN INI
          </div>
          <div className="num mt-2 text-xl font-extrabold text-bark-900 md:text-2xl">{rmShort(spendTotal)}</div>
          <div className="mt-1.5">
            <SourceBar franchisor={data.spend_month.franchisor} local={data.spend_month.local} />
          </div>
          <div className="mt-1 text-[11px] text-bark-700/60">
            Francais {rmShort(data.spend_month.franchisor)} · Tempatan {rmShort(data.spend_month.local)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-bark-700/60">
            <AlertTriangle size={14} /> PERLU DIPESAN
          </div>
          <div className={`num mt-2 text-xl font-extrabold md:text-2xl ${data.low_stock.length > 0 ? 'text-amber-warn' : 'text-bark-900'}`}>
            {data.low_stock.length}
          </div>
          <div className="mt-0.5 text-xs text-bark-700/60">{data.out_count} habis · {data.low_count} rendah</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-bark-700/60">
            <TrendingUp size={14} /> UNJURAN 30 HARI
          </div>
          <div className="num mt-2 text-xl font-extrabold text-bark-900 md:text-2xl">{rmShort(projectionTotal)}</div>
          <div className="mt-0.5 text-xs text-bark-700/60">kos penggunaan akan datang</div>
        </Card>
      </div>

      {/* Perlu perhatian */}
      <section>
        <SectionTitle
          action={
            data.low_stock.length > 0 ? (
              <Link href="/inventori?filter=low" className="flex items-center text-xs font-semibold text-coffee-500">
                Semua <ChevronRight size={14} />
              </Link>
            ) : undefined
          }
        >
          Perlu Perhatian
        </SectionTitle>
        {data.low_stock.length === 0 ? (
          <Card className="px-4 py-5 text-center text-sm text-bark-700/60">
            Semua stok dalam keadaan baik 👍
          </Card>
        ) : (
          <Card className="divide-y divide-cream-100">
            {data.low_stock.slice(0, 5).map((it) => {
              const st = labelStatus(it.status);
              const pct = it.min_qty > 0 ? Math.max(0, Math.min(100, (Math.max(0, it.stock) / it.min_qty) * 100)) : 0;
              return (
                <Link key={it.id} href="/inventori" className="block px-4 py-3.5 hover:bg-cream-100/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-bark-900">{it.name}</div>
                      <div className="text-xs text-bark-700/60">
                        {SOURCE_LABEL[it.source]} · minimum {angka(it.min_qty)} {it.unit}
                        {it.days_left !== null ? ` · ${hariBerbaki(it.days_left)} lagi` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`num text-[15px] font-bold ${it.status === 'habis' ? 'text-berry-600' : 'text-amber-warn'}`}>
                        {angka(it.stock)} <span className="text-xs font-medium">{it.unit}</span>
                      </div>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div className={`h-full rounded-full ${it.status === 'habis' ? 'bg-berry-600' : 'bg-amber-warn'}`} style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </section>

      {/* Aktiviti terkini */}
      <section>
        <SectionTitle>Aktiviti Terkini</SectionTitle>
        {data.recent.length === 0 ? (
          <EmptyState icon={<Boxes size={24} />} title="Tiada aktiviti lagi" message="Rekod pembelian pertama anda akan muncul di sini." />
        ) : (
          <Card className="divide-y divide-cream-100">
            {data.recent.map((m) => (
              <MovementRow key={`${m.kind}-${m.id}`} m={m} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
