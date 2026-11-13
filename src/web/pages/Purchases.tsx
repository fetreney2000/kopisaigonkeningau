import { useMemo, useState } from 'react';
import { PackagePlus, Trash2, Wallet } from 'lucide-react';
import { api, useApi } from '../api';
import { angka, bulan, hariIni, rm, rmShort, tarikh } from '../format';
import { Button, Card, ConfirmModal, EmptyState, ErrorState, Field, inputCls, SectionTitle, Spinner, toast } from '../ui';
import { SourceBar } from '../chart';
import { ItemPickerField } from './ItemPicker';
import type { ItemWithStock, Purchase, SourceTotals } from '../../shared/types';

export default function Purchases() {
  const list = useApi<{ items: Purchase[] }>('/api/purchases?limit=100');
  const summary = useApi<{ spend_month: SourceTotals; usage_cost_30d: SourceTotals }>('/api/summary');

  // Borang
  const [item, setItem] = useState<ItemWithStock | null>(null);
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [date, setDate] = useState(hariIni());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const spend = summary.data?.spend_month;

  const grouped = useMemo(() => {
    const rows = list.data?.items ?? [];
    const map = new Map<string, Purchase[]>();
    for (const p of rows) {
      const ym = p.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(p);
    }
    return [...map.entries()];
  }, [list.data]);

  async function save() {
    if (!item) {
      setErr('Pilih item terlebih dahulu.');
      return;
    }
    const q = parseFloat(qty);
    if (!q || q <= 0) {
      setErr('Kuantiti mesti melebihi sifar.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api.post('/api/purchases', { item_id: item.id, qty: q, unit_cost: parseFloat(cost) || 0, date, note });
      toast('Pembelian direkod');
      setQty('');
      setNote('');
      item.unit_cost = parseFloat(cost) || item.unit_cost; // kos seunit terkini
      list.reload();
      summary.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ralat');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!delId) return;
    await api.del(`/api/purchases/${delId}`);
    toast('Pembelian dibatalkan');
    setDelId(null);
    list.reload();
    summary.reload();
  }

  return (
    <div className="space-y-5">
      {/* Ringkasan bulan */}
      {spend && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-bark-700/60">
            <Wallet size={14} /> BELANJA BULAN INI
          </div>
          <div className="num mt-1.5 text-2xl font-extrabold text-bark-900">
            {rmShort(spend.franchisor + spend.local)}
          </div>
          <div className="mt-2">
            <SourceBar franchisor={spend.franchisor} local={spend.local} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-bark-700/70">
            <span className="num">Francais {rm(spend.franchisor)}</span>
            <span className="num">Tempatan {rm(spend.local)}</span>
          </div>
        </Card>
      )}

      {/* Borang rekod pembelian */}
      <Card className="p-4">
        <SectionTitle>Rekod Pembelian</SectionTitle>
        <div className="space-y-4">
          <ItemPickerField
            label="Item *"
            item={item}
            onPick={(i) => {
              setItem(i);
              setCost(String(i.unit_cost));
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kuantiti *">
              <input className={`${inputCls} num`} type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Kos Seunit (RM) *">
              <input className={`${inputCls} num`} type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tarikh">
              <input className={`${inputCls} num`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Jumlah">
              <div className={`${inputCls} flex items-center !border-dashed !bg-cream-100`}>
                <b className="num text-bark-900">{rm((parseFloat(qty) || 0) * (parseFloat(cost) || 0))}</b>
              </div>
            </Field>
          </div>
          <Field label="Nota">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {err && <p className="text-sm font-medium text-berry-600">{err}</p>}
          <Button full onClick={save} disabled={saving}>
            <PackagePlus size={17} /> {saving ? 'Menyimpan…' : 'Rekod Pembelian'}
          </Button>
        </div>
      </Card>

      {/* Sejarah pembelian */}
      <section>
        <SectionTitle>Sejarah Pembelian</SectionTitle>
        {list.loading ? (
          <Spinner />
        ) : list.error ? (
          <ErrorState message={list.error} reload={list.reload} />
        ) : grouped.length === 0 ? (
          <EmptyState icon={<PackagePlus size={24} />} title="Tiada pembelian lagi" message="Rekod pembelian pertama anda — stok akan bertambah secara automatik." />
        ) : (
          <div className="space-y-4">
            {grouped.map(([ym, rows]) => (
              <div key={ym}>
                <div className="mb-2 px-1 text-sm font-bold text-bark-700">{bulan(ym)}</div>
                <Card className="divide-y divide-cream-100">
                  {rows.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-bark-900">{p.item_name ?? '—'}</div>
                        <div className="num text-xs text-bark-700/60">
                          {tarikh(p.date)} · {angka(p.qty)} × {rm(p.unit_cost)}
                          {p.note ? ` · ${p.note}` : ''}
                        </div>
                      </div>
                      <div className="num text-[15px] font-bold text-bark-900">{rm(p.qty * p.unit_cost)}</div>
                      <button
                        onClick={() => setDelId(p.id)}
                        className="rounded-full p-2 text-bark-700/40 hover:bg-berry-soft hover:text-berry-600"
                        aria-label="Batalkan pembelian"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={!!delId}
        title="Batalkan Pembelian?"
        message="Rekod ini akan dipadam dan kuantiti stok akan dikira semula."
        confirmLabel="Batalkan Pembelian"
        onCancel={() => setDelId(null)}
        onConfirm={del}
      />
    </div>
  );
}
