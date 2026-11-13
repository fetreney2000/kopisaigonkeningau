import { useMemo, useState } from 'react';
import { ClipboardCopy, Download, ListOrdered, PackageMinus, ReceiptText, SlidersHorizontal, TrendingUp, UserRound, Wallet } from 'lucide-react';
import { useApi } from '../api';
import { angka, bulanPendek, hariBerbaki, rm, rmShort, SOURCE_LABEL, tarikh } from '../format';
import { SpendChart } from '../chart';
import { Badge, Button, Card, EmptyState, ErrorState, SectionTitle, Segmented, Spinner, toast } from '../ui';
import type { Reports } from '../../shared/types';

/** Kuantiti pesanan cadangan: bawa stok ke paras selamat (minimum atau 14 hari penggunaan) */
export function cadanganPesanan(stock: number, minQty: number, dailyRate: number): number {
  const target = Math.max(minQty, Math.ceil(dailyRate * 14));
  return Math.max(0, Math.ceil(target - stock));
}

export default function ReportsPage() {
  const [months, setMonths] = useState<'3' | '6' | '12'>('6');
  const [bv, setBv] = useState<'total' | 'franchisor' | 'local'>('total');
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

  /** Item yang perlu dipesan + kuantiti cadangan, dikumpulkan mengikut sumber */
  const reorder = useMemo(() => {
    if (!data) return [];
    return data.items
      .map((it) => ({ it, qty: cadanganPesanan(it.stock, it.min_qty, it.daily_rate) }))
      .filter((r) => r.qty > 0)
      .sort((a, b) => b.it.daily_rate - a.it.daily_rate);
  }, [data]);

  function salinSenaraiPesanan() {
    const franchisor = reorder.filter((r) => r.it.source === 'franchisor');
    const local = reorder.filter((r) => r.it.source === 'local');
    const lines: string[] = ['SENARAI PESANAN', new Date().toLocaleDateString('ms-MY'), ''];
    const blok = (tajuk: string, list: typeof reorder) => {
      if (list.length === 0) return;
      lines.push(tajuk);
      for (const { it, qty } of list) lines.push(`- ${it.name}: ${angka(qty)} ${it.unit}`);
      lines.push('');
    };
    blok('FRANCAIS', franchisor);
    blok('KEDAI TEMPATAN', local);
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => toast('Senarai pesanan disalin — tampal dalam WhatsApp/nota', 'success'))
      .catch(() => toast('Gagal menyalin', 'error'));
  }

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
    lines.push('Bulan,Belanja Francais (RM),Belanja Tempatan (RM),Penggunaan Francais (RM),Penggunaan Tempatan (RM),Jumlah Belanja (RM),Jumlah Penggunaan (RM),Beza (RM)');
    for (const m of data.months) {
      const spend = m.spend_franchisor + m.spend_local;
      const usage = m.usage_franchisor + m.usage_local;
      lines.push([m.ym, angka(m.spend_franchisor), angka(m.spend_local), angka(m.usage_franchisor), angka(m.usage_local), angka(spend), angka(usage), angka(spend - usage)].join(','));
    }
    lines.push('');
    lines.push('Senarai Pesanan');
    lines.push('Item,Sumber,Cadangan Kuantiti,Unit');
    for (const { it, qty } of reorder) {
      lines.push([`"${it.name.replace(/"/g, '""')}"`, SOURCE_LABEL[it.source], angka(qty), it.unit].join(','));
    }
    lines.push('');
    lines.push('Pengeluaran mengikut Pengguna (30 hari)');
    lines.push('Pengguna,Bilangan Rekod,Kuantiti,Nilai (RM)');
    for (const s of data.staff_usage) {
      lines.push([`"${s.user_name ?? 'Tidak direkod'}"`, angka(s.count), angka(s.qty), angka(s.cost)].join(','));
    }
    lines.push('');
    lines.push('Pelarasan Stok');
    lines.push('Tarikh,Item,Kuantiti (Δ),Sebab,Nilai (RM)');
    for (const a of data.adjustments) {
      lines.push([a.date, `"${a.item_name.replace(/"/g, '""')}"`, angka(a.delta), `"${a.reason.replace(/"/g, '""')}"`, angka(a.value)].join(','));
    }
    lines.push('');
    lines.push('Mengikut Kategori');
    lines.push('Kategori,Belanja (RM),Kos Penggunaan (RM)');
    for (const k of data.by_category) {
      lines.push([`"${k.category}"`, angka(k.spend), angka(k.usage_cost)].join(','));
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

      {/* Belanja vs penggunaan (jadual bulanan) */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 px-4 py-3">
          <div>
            <h3 className="font-bold text-bark-900">
              Belanja vs Penggunaan
              {bv !== 'total' && <span className="text-bark-700/60"> — {SOURCE_LABEL[bv]}</span>}
            </h3>
            <p className="text-xs text-bark-700/60">Beza positif = dibeli lebih daripada digunakan (stok bertambah); negatif = stok digunakan melebihi pembelian</p>
          </div>
          <Segmented
            value={bv}
            onChange={setBv}
            options={[
              { value: 'total', label: 'Jumlah' },
              { value: 'franchisor', label: 'Francais' },
              { value: 'local', label: 'Tempatan' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-[11px] font-bold uppercase tracking-wide text-bark-700/60">
                <th className="px-4 py-2.5">Bulan</th>
                <th className="px-3 py-2.5 text-right">Belanja</th>
                <th className="px-3 py-2.5 text-right">Penggunaan</th>
                <th className="px-4 py-2.5 text-right">Beza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {[...data.months].reverse().map((m) => {
                const spend = bv === 'total' ? m.spend_franchisor + m.spend_local : bv === 'franchisor' ? m.spend_franchisor : m.spend_local;
                const usage = bv === 'total' ? m.usage_franchisor + m.usage_local : bv === 'franchisor' ? m.usage_franchisor : m.usage_local;
                const delta = spend - usage;
                return (
                  <tr key={m.ym} className="hover:bg-cream-100/50">
                    <td className="px-4 py-2.5 font-semibold text-bark-900">{bulanPendek(m.ym)}</td>
                    <td className="num px-3 py-2.5 text-right">{rm(spend)}</td>
                    <td className="num px-3 py-2.5 text-right">{rm(usage)}</td>
                    <td className={`num px-4 py-2.5 text-right font-bold ${delta >= 0 ? 'text-bark-800' : 'text-berry-600'}`}>
                      {delta >= 0 ? '+' : '−'}{rm(Math.abs(delta))}
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const sum = (k: 'spend' | 'usage') =>
                  data.months.reduce((s, m) =>
                    s + (bv === 'total' ? (k === 'spend' ? m.spend_franchisor + m.spend_local : m.usage_franchisor + m.usage_local)
                      : bv === 'franchisor' ? (k === 'spend' ? m.spend_franchisor : m.usage_franchisor)
                      : (k === 'spend' ? m.spend_local : m.usage_local)), 0);
                const s = sum('spend'), u = sum('usage'), d = s - u;
                return (
                  <tr className="bg-cream-100/70 font-bold">
                    <td className="px-4 py-2.5">Jumlah</td>
                    <td className="num px-3 py-2.5 text-right">{rm(s)}</td>
                    <td className="num px-3 py-2.5 text-right">{rm(u)}</td>
                    <td className="num px-4 py-2.5 text-right">{d >= 0 ? '+' : '−'}{rm(Math.abs(d))}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
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

      {/* Senarai pesanan */}
      <section>
        <SectionTitle
          action={
            reorder.length > 0 ? (
              <Button variant="secondary" className="!min-h-8 !px-2.5 !text-xs" onClick={salinSenaraiPesanan}>
                <ClipboardCopy size={13} /> Salin Senarai
              </Button>
            ) : undefined
          }
        >
          <span className="flex items-center gap-1.5"><ListOrdered size={14} /> Senarai Pesanan ({reorder.length})</span>
        </SectionTitle>
        {reorder.length === 0 ? (
          <EmptyState icon={<ListOrdered size={22} />} title="Tiada item perlu dipesan" message="Semua stok mencukupi buat masa ini." />
        ) : (
          <div className="space-y-3">
            {(['franchisor', 'local'] as const).map((src) => {
              const list = reorder.filter((r) => r.it.source === src);
              if (list.length === 0) return null;
              return (
                <Card key={src} className="overflow-hidden">
                  <div className="border-b border-cream-200 bg-cream-100/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-bark-700/70">
                    {SOURCE_LABEL[src]}
                  </div>
                  <div className="divide-y divide-cream-100">
                    {list.map(({ it, qty }) => (
                      <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-bark-900">{it.name}</span>
                          <span className="num block text-xs text-bark-700/60">
                            Ada {angka(Math.max(0, it.stock))} {it.unit}{it.min_qty > 0 ? ` · minimum ${angka(it.min_qty)}` : ''}
                          </span>
                        </span>
                        <span className="num text-right">
                          <span className="block text-[15px] font-extrabold text-coffee-500">{angka(qty)} {it.unit}</span>
                          <span className="block text-[10px] text-bark-700/50">cadangan pesan</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
            <p className="px-1 text-xs leading-relaxed text-bark-700/60">
              Cadangan = stok dibawa ke paras selamat: paras minimum item, atau bekalan 14 hari
              (purata penggunaan harian), mengikut yang lebih tinggi.
            </p>
          </div>
        )}
      </section>

      {/* Penggunaan tertinggi 30 hari */}
      <section>
        <SectionTitle>Penggunaan Tertinggi (30 Hari)</SectionTitle>
        {data.top_usage.length === 0 ? (
          <EmptyState icon={<UserRound size={22} />} title="Tiada rekod penggunaan" message="Tiada rekod penggunaan dalam 30 hari lalu." />
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

      {/* Pengeluaran mengikut pengguna (30 hari) */}
      <section>
        <SectionTitle>
          <span className="flex items-center gap-1.5"><UserRound size={14} /> Pengeluaran mengikut Pengguna (30 Hari)</span>
        </SectionTitle>
        {data.staff_usage.length === 0 ? (
          <EmptyState icon={<PackageMinus size={22} />} title="Tiada rekod pengeluaran" message="Tiada rekod pengeluaran dalam 30 hari lalu." />
        ) : (
          <Card className="divide-y divide-cream-100">
            {data.staff_usage.map((s) => {
              const max = data.staff_usage[0].cost || 1;
              return (
                <div key={s.user_name ?? 'x'} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-bark-900">{s.user_name ?? 'Tidak direkod (lama)'}</div>
                      <div className="num text-xs text-bark-700/60">
                        {angka(s.count)} rekod · {angka(s.qty)} unit
                      </div>
                    </div>
                    <span className="num text-[15px] font-bold text-bark-900">{rm(s.cost)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div className="h-full rounded-full bg-bark-700" style={{ width: `${(s.cost / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* Pelarasan stok (susut) */}
      <section>
        <SectionTitle>
          <span className="flex items-center gap-1.5"><SlidersHorizontal size={14} /> Pelarasan Stok ({data.adjustments.length})</span>
        </SectionTitle>
        {data.adjustments.length === 0 ? (
          <EmptyState icon={<SlidersHorizontal size={22} />} title="Tiada pelarasan" message="Tiada pelarasan dalam tempoh ini." />
        ) : (
          <>
            {(() => {
              const total = data.adjustments.reduce((s, a) => s + a.value, 0);
              const neg = data.adjustments.filter((a) => a.delta < 0).reduce((s, a) => s + a.value, 0);
              const pos = total - neg;
              return (
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-cream-100 py-3">
                    <div className="text-[11px] font-semibold text-bark-700/60">TAMBAHAN</div>
                    <div className="num mt-1 text-base font-extrabold text-bark-900">{rmShort(pos)}</div>
                  </div>
                  <div className="rounded-xl bg-cream-100 py-3">
                    <div className="text-[11px] font-semibold text-bark-700/60">SUSUT / ROSAK</div>
                    <div className="num mt-1 text-base font-extrabold text-berry-600">{rmShort(Math.abs(neg))}</div>
                  </div>
                  <div className="rounded-xl bg-bark-800 py-3 text-cream-50">
                    <div className="text-[11px] font-semibold text-cream-50/60">NILAI BERSIH</div>
                    <div className="num mt-1 text-base font-extrabold">{rmShort(total)}</div>
                  </div>
                </div>
              );
            })()}
            <Card className="divide-y divide-cream-100">
              {data.adjustments.slice(0, 30).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${a.delta < 0 ? 'bg-berry-soft text-berry-600' : 'bg-cream-200 text-coffee-500'}`}>
                    <PackageMinus size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-bark-900">{a.item_name}</span>
                    <span className="num block text-xs text-bark-700/60">
                      {tarikh(a.date)}{a.reason ? ` · ${a.reason}` : ''}
                    </span>
                  </span>
                  <span className="num text-right">
                    <span className={`block text-[15px] font-bold ${a.delta < 0 ? 'text-berry-600' : 'text-bark-800'}`}>
                      {a.delta > 0 ? '+' : '−'}{angka(Math.abs(a.delta))} {a.unit}
                    </span>
                    <span className="block text-[10px] text-bark-700/50">{rm(Math.abs(a.value))}</span>
                  </span>
                </div>
              ))}
              {data.adjustments.length > 30 && (
                <div className="px-4 py-2.5 text-center text-xs text-bark-700/50">… {data.adjustments.length - 30} pelarasan lain (lihat CSV)</div>
              )}
            </Card>
          </>
        )}
      </section>

      {/* Belanja mengikut kategori */}
      <section>
        <SectionTitle>
          <span className="flex items-center gap-1.5"><ReceiptText size={14} /> Belanja mengikut Kategori</span>
        </SectionTitle>
        {data.by_category.length === 0 ? (
          <EmptyState icon={<ReceiptText size={22} />} title="Tiada rekod" message="Tiada rekod dalam tempoh ini." />
        ) : (
          <Card className="divide-y divide-cream-100">
            {data.by_category.map((k) => {
              const max = Math.max(...data.by_category.map((x) => x.spend + x.usage_cost)) || 1;
              const total = k.spend + k.usage_cost;
              return (
                <div key={k.category} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-[15px] font-semibold text-bark-900">{k.category}</div>
                    <span className="num text-[15px] font-bold text-bark-900">{rm(total)}</span>
                  </div>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div className="h-full bg-coffee-500" style={{ width: `${(k.spend / max) * 100}%` }} />
                    <div className="h-full bg-bark-600" style={{ width: `${(k.usage_cost / max) * 100}%` }} />
                  </div>
                  <div className="num mt-1.5 flex gap-4 text-[11px] text-bark-700/60">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-coffee-500" /> belanja {rm(k.spend)}</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-bark-600" /> guna {rm(k.usage_cost)}</span>
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
