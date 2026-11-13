import { useMemo, useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { useApi } from '../api';
import { angka, bulanPendek, hariBerbaki, rm, rmShort, SOURCE_LABEL } from '../format';
import { SpendChart } from '../chart';
import { Badge, Button, Card, ErrorState, Segmented, SectionTitle, Spinner, toast } from '../ui';
import type { Reports } from '../../shared/types';

export default function ReportsPage() {
  const [months, setMonths] = useState<'3' | '6' | '12'>('6');
  const { data, loading, error, reload } = useApi<Reports>(`/api/reports?months=${months}`);

  const totals = useMemo(() => {
    if (!data) return null;
    let spendF = 0, spendL = 0, usageF = 0, usageL = 0, projF = 0, projL = 0;
    for (const m of data.months) {
      spendF += m.spend_franchisor; spendL += m.spend_local;
      usageF += m.usage_franchisor; usageL += m.usage_local;
    }
    for (const it of data.items) {
      if (it.source === 'franchisor') projF += it.projected_monthly_cost;
      else projL += it.projected_monthly_cost;
    }
    return { spendF, spendL, usageF, usageL, projF, projL };
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const lines: string[] = [];
    lines.push('Unjuran per Item');
    lines.push('Item,Sumber,Stok Semasa,Unit,Purata Harian,Baki Hari,Unjuran Kos Bulanan (RM)');
    for (const it of data.items) {
      lines.push([
        `"${it.name.replace(/"/g, '""')}"`, SOURCE_LABEL[it.source], angka(it.stock), it.unit,
        angka(Math.round(it.daily_rate * 1000) / 1000),
        it.days_left === null ? '' : String(Math.round(it.days_left)),
        angka(it.projected_monthly_cost),
      ].join(','));
    }
    lines.push('');
    lines.push('Bulanan');
    lines.push('Bulan,Belanja Francais (RM),Belanja Tempatan (RM),Penggunaan Francais (RM),Penggunaan Tempatan (RM)');
    for (const m of data.months) {
      lines.push([m.ym, angka(m.spend_franchisor), angka(m.spend_local), angka(m.usage_franchisor), angka(m.usage_local)].join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-inventori-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast('Fail CSV dieksport');
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} reload={reload} />;
  if (!data || !totals) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={months}
          onChange={setMonths}
          options={[
            { value: '3', label: '3 Bulan' },
            { value: '6', label: '6 Bulan' },
            { value: '12', label: '12 Bulan' },
          ]}
        />
        <Button variant="secondary" onClick={exportCsv}><Download size={16} /> Eksport CSV</Button>
      </div>

      {/* Belanja bulanan */}
      <Card className="p-4">
        <SectionTitle>Belanja Bulanan</SectionTitle>
        <SpendChart months={data.months} mode="spend" />
        <div className="num mt-3 grid grid-cols-2 gap-3 border-t border-cream-200 pt-3 text-sm">
          <div>
            <span className="text-bark-700/60">Jumlah Francais: </span>
            <b className="text-bark-900">{rm(totals.spendF)}</b>
          </div>
          <div className="text-right">
            <span className="text-bark-700/60">Jumlah Tempatan: </span>
            <b className="text-bark-900">{rm(totals.spendL)}</b>
          </div>
        </div>
      </Card>

      {/* Kos penggunaan bulanan */}
      <Card className="p-4">
        <SectionTitle>Kos Penggunaan Bulanan</SectionTitle>
        <SpendChart months={data.months} mode="usage" />
        <p className="mt-3 border-t border-cream-200 pt-3 text-xs leading-relaxed text-bark-700/60">
          Kos penggunaan dikira daripada kuantiti stok keluar × kos seunit semasa. Ini memberi gambaran
          berapa nilai bahan yang benar-benar digunakan berbanding apa yang dibeli.
        </p>
      </Card>

      {/* Unjuran */}
      <Card className="p-4">
        <SectionTitle
          action={
            <Badge className="bg-cream-200 text-bark-700">30 hari akan datang</Badge>
          }
        >
          <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Unjuran Kos</span>
        </SectionTitle>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-cream-100 py-3">
            <div className="text-[11px] font-semibold text-bark-700/60">FRANCAIS</div>
            <div className="num mt-1 text-lg font-extrabold text-bark-900">{rmShort(totals.projF)}</div>
          </div>
          <div className="rounded-xl bg-cream-100 py-3">
            <div className="text-[11px] font-semibold text-bark-700/60">TEMPATAN</div>
            <div className="num mt-1 text-lg font-extrabold text-bark-900">{rmShort(totals.projL)}</div>
          </div>
          <div className="rounded-xl bg-bark-800 py-3 text-cream-50">
            <div className="text-[11px] font-semibold text-cream-50/60">JUMLAH</div>
            <div className="num mt-1 text-lg font-extrabold">{rmShort(totals.projF + totals.projL)}</div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-bark-700/60">
          Unjuran berdasarkan purata penggunaan 30 hari lalu bagi setiap item × kos seunit.
          Item yang jarang digunakan tidak diambil kira sehingga ia mempunyai rekod penggunaan.
        </p>
      </Card>

      {/* Jadual unjuran per item */}
      <Card className="overflow-hidden">
        <div className="border-b border-cream-200 px-4 py-3">
          <h3 className="font-bold text-bark-900">Unjuran per Item</h3>
          <p className="text-xs text-bark-700/60">Disusun mengikut unjuran kos bulanan tertinggi</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-[11px] font-bold uppercase tracking-wide text-bark-700/60">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-3 py-2.5 text-right">Stok</th>
                <th className="px-3 py-2.5 text-right">Purata/Hari</th>
                <th className="px-3 py-2.5 text-right">Baki</th>
                <th className="px-4 py-2.5 text-right">Unjuran/Bulan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {data.items.map((it) => (
                <tr key={it.id} className="hover:bg-cream-100/50">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-bark-900">{it.name}</div>
                    <div className="text-[11px] text-bark-700/60">{SOURCE_LABEL[it.source]}</div>
                  </td>
                  <td className="num px-3 py-2.5 text-right">{angka(it.stock)} <span className="text-[11px] text-bark-700/60">{it.unit}</span></td>
                  <td className="num px-3 py-2.5 text-right text-bark-700">{it.daily_rate > 0 ? angka(Math.round(it.daily_rate * 1000) / 1000) : '–'}</td>
                  <td className={`num px-3 py-2.5 text-right ${it.days_left !== null && it.days_left <= 7 ? 'font-bold text-berry-600' : 'text-bark-700'}`}>
                    {hariBerbaki(it.days_left)}
                  </td>
                  <td className="num px-4 py-2.5 text-right font-bold text-bark-900">
                    {it.projected_monthly_cost > 0 ? rm(it.projected_monthly_cost) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Penggunaan tertinggi 30 hari */}
      <section>
        <SectionTitle>Penggunaan Tertinggi (30 Hari)</SectionTitle>
        {data.top_usage.length === 0 ? (
          <Card className="px-4 py-5 text-center text-sm text-bark-700/60">Tiada rekod penggunaan dalam 30 hari lalu.</Card>
        ) : (
          <Card className="divide-y divide-cream-100">
            {data.top_usage.map((t, i) => {
              const max = data.top_usage[0].cost || 1;
              return (
                <div key={t.item_id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-bark-900">
                        <span className="num mr-1.5 text-xs font-bold text-bark-700/40">#{i + 1}</span>
                        {t.name}
                      </div>
                      <div className="num text-xs text-bark-700/60">
                        {SOURCE_LABEL[t.source]} · {angka(t.qty)} {t.unit} digunakan
                      </div>
                    </div>
                    <span className="num text-[15px] font-bold text-bark-900">{rm(t.cost)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div className="h-full rounded-full bg-coffee-500" style={{ width: `${(t.cost / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
