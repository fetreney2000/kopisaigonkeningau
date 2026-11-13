import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronRight, PackageMinus, PackagePlus, Pencil, Plus, Printer, QrCode, Search, SlidersHorizontal, Trash2, Wallet,
} from 'lucide-react';
import { api, useApi } from '../api';
import { angka, hariBerbaki, hariDari, hariIni, labelStatus, rm, SOURCE_LABEL, STATUS_LABEL, tarikh } from '../format';
import {
  Badge, Button, Card, ConfirmModal, EmptyState, ErrorState, Field, inputCls, Modal, Segmented, SectionTitle, Spinner, toast,
} from '../ui';
import { navigate } from '../App';
import QRCodeImg from './QRCodeImg';
import type { Item, ItemDetail, ItemWithStock, Source } from '../../shared/types';

// ------------------------------------------------------------------ Borang item

interface ItemFormValues {
  name: string; category: string; unit: string; source: Source; unit_cost: string; min_qty: string; note: string;
}

const emptyForm: ItemFormValues = { name: '', category: '', unit: '', source: 'franchisor', unit_cost: '', min_qty: '', note: '' };

function ItemFormModal({ open, item, onClose, onSaved }: { open: boolean; item: ItemWithStock | null; onClose: () => void; onSaved: () => void }) {
  const [vals, setVals] = useState<ItemFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setErr('');
      setVals(item ? {
        name: item.name, category: item.category, unit: item.unit, source: item.source,
        unit_cost: String(item.unit_cost), min_qty: String(item.min_qty), note: item.note,
      } : emptyForm);
    }
  }, [open, item]);

  const set = (k: keyof ItemFormValues) => (e: { target: { value: string } }) => setVals((v) => ({ ...v, [k]: e.target.value }));

  async function save() {
    if (!vals.name.trim()) {
      setErr('Nama item diperlukan.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const body = {
        name: vals.name, category: vals.category, unit: vals.unit, source: vals.source,
        unit_cost: vals.unit_cost || 0, min_qty: vals.min_qty || 0, note: vals.note,
      };
      if (item) await api.put(`/api/items/${item.id}`, body);
      else await api.post('/api/items', body);
      toast(item ? 'Item dikemas kini' : 'Item baharu ditambah');
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ralat');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Sunting Item' : 'Tambah Item'}>
      <div className="space-y-4">
        <Field label="Nama Item *">
          <input className={inputCls} value={vals.name} onChange={set('name')} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <input className={inputCls} value={vals.category} onChange={set('category')} />
          </Field>
          <Field label="Unit">
            <input className={inputCls} value={vals.unit} onChange={set('unit')} list="unit-list" />
            <datalist id="unit-list">
              <option value="kg" /><option value="g" /><option value="L" /><option value="ml" />
              <option value="biji" /><option value="bungkus" /><option value="kotak" /><option value="tin" />
              <option value="botol" /><option value="karton" /><option value="tiub" /><option value="pakej" />
              <option value="unit" /><option value="pc" />
            </datalist>
          </Field>
        </div>
        <Field label="Sumber Item" hint="Francais = dibeli daripada pembekal franchise · Tempatan = dibeli daripada kedai setempat">
          <Segmented
            value={vals.source}
            onChange={(v) => setVals((s) => ({ ...s, source: v }))}
            options={[
              { value: 'franchisor', label: 'Francais' },
              { value: 'local', label: 'Kedai Tempatan' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kos Seunit (RM)">
            <input className={`${inputCls} num`} type="number" inputMode="decimal" step="0.01" min="0" value={vals.unit_cost} onChange={set('unit_cost')} />
          </Field>
          <Field label="Stok Minimum" hint="Amaran dikeluarkan apabila stok sampai tahap ini">
            <input className={`${inputCls} num`} type="number" inputMode="decimal" step="any" min="0" value={vals.min_qty} onChange={set('min_qty')} />
          </Field>
        </div>
        <Field label="Nota">
          <textarea className={`${inputCls} min-h-20 resize-none`} value={vals.note} onChange={set('note')} />
        </Field>
        {err && <p className="text-sm font-medium text-berry-600">{err}</p>}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" full onClick={onClose}>Batal</Button>
          <Button full onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Borang pergerakan

function MovementModal({ kind, item, onClose, onSaved }: {
  kind: 'purchase' | 'usage' | 'adjust';
  item: ItemWithStock;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(String(item.unit_cost));
  const [adjustDir, setAdjustDir] = useState<'plus' | 'minus'>('plus');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(hariIni());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const titles = {
    purchase: `Stok Masuk: ${item.name}`,
    usage: `Stok Keluar: ${item.name}`,
    adjust: `Laraskan Stok: ${item.name}`,
  } as const;

  async function save() {
    const q = parseFloat(qty);
    if (!q || q <= 0) {
      setErr('Kuantiti mesti melebihi sifar.');
      return;
    }
    const k = parseFloat(cost);
    if (kind === 'purchase' && (!k || k <= 0)) {
      setErr('Kos seunit mesti lebih daripada sifar.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      if (kind === 'purchase') {
        await api.post('/api/purchases', { item_id: item.id, qty: q, unit_cost: k, date, note });
      } else if (kind === 'usage') {
        await api.post('/api/usages', { item_id: item.id, qty: q, date, note });
      } else {
        await api.post('/api/adjustments', { item_id: item.id, delta: adjustDir === 'plus' ? q : -q, date, reason });
      }
      toast(kind === 'purchase' ? 'Stok masuk direkod' : kind === 'usage' ? 'Stok keluar direkod' : 'Pelarasan direkod');
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ralat');
    } finally {
      setSaving(false);
    }
  }

  const qtyLabel = kind === 'adjust' ? 'Nilai Pelarasan' : 'Kuantiti';

  return (
    <Modal open onClose={onClose} title={titles[kind]}>
      <div className="space-y-4">
        <div className="num rounded-xl bg-cream-100 px-4 py-3 text-sm text-bark-700">
          Stok semasa: <b className="text-bark-900">{angka(item.stock)} {item.unit}</b>
          {kind === 'usage' && item.stock <= 0 && <span className="ml-2 font-semibold text-berry-600">(stok kosong)</span>}
        </div>

        {kind === 'adjust' && (
          <Segmented
            value={adjustDir}
            onChange={setAdjustDir}
            options={[{ value: 'plus', label: 'Tambah Stok' }, { value: 'minus', label: 'Kurangkan Stok' }]}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={qtyLabel}>
            <input className={`${inputCls} num`} type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </Field>
          {kind === 'purchase' && (
            <Field label="Kos Seunit (RM)">
              <input className={`${inputCls} num`} type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          )}
          <Field label="Tarikh">
            <input className={`${inputCls} num`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {kind === 'purchase' && (
          <div className="num rounded-xl bg-cream-100 px-4 py-3 text-sm text-bark-700">
            Jumlah: <b className="text-bark-900">{rm((parseFloat(qty) || 0) * (parseFloat(cost) || 0))}</b>
          </div>
        )}

        {kind === 'adjust' && (
          <Field label="Sebab Pelarasan" hint="cth. kiraan fizikal, rosak, hilang">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} list="reason-list" />
            <datalist id="reason-list">
              <option value="Kiraan fizikal" /><option value="Rosak" /><option value="Hilang" /><option value="Pembetulan" />
            </datalist>
          </Field>
        )}

        {kind !== 'adjust' && (
          <Field label="Nota">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}

        {kind === 'usage' && (parseFloat(qty) || 0) > item.stock && (
          <p className="text-sm font-medium text-amber-warn">⚠ Kuantiti melebihi stok semasa dan akan ditolak. Laraskan stok dahulu jika kiraan fizikal berbeza.</p>
        )}

        {err && <p className="text-sm font-medium text-berry-600">{err}</p>}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" full onClick={onClose}>Batal</Button>
          <Button full onClick={save} disabled={saving}>
            {kind === 'purchase' ? 'Rekod Masuk' : kind === 'usage' ? 'Rekod Keluar' : 'Simpan Pelarasan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Butiran item

function HistoryRow({ icon, cls, main, sub, right }: { icon: React.ReactNode; cls: string; main: string; sub: string; right: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-bark-900">{main}</div>
        <div className="text-xs text-bark-700/60">{sub}</div>
      </div>
      <span className="num shrink-0 text-sm font-bold text-bark-900">{right}</span>
    </div>
  );
}

function ItemDetailModal({ itemId, onClose, onChanged }: { itemId: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error, reload } = useApi<ItemDetail>(`/api/items/${itemId}`);
  const [move, setMove] = useState<'purchase' | 'usage' | 'adjust' | null>(null);
  const [tab, setTab] = useState<'kad' | 'senarai'>('kad');
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function del() {
    if (!data) return;
    try {
      await api.del(`/api/items/${data.item.id}`);
      toast('Item dipadam');
      setConfirmDel(false);
      onChanged();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memadam item', 'error');
      setConfirmDel(false);
    }
  }

  const history = useMemo(() => {
    if (!data) return [];
    const rows: { kind: 'purchase' | 'usage' | 'adjust'; id: string; main: string; sub: string; right: string; neg: boolean; ts: number }[] = [];
    for (const p of data.purchases) rows.push({ kind: 'purchase', id: p.id, main: 'Stok Masuk', sub: `${tarikh(p.date)}${p.note ? ` · ${p.note}` : ''}`, right: `+${angka(p.qty)}`, neg: false, ts: Date.parse(p.created_at) });
    for (const u of data.usages) rows.push({ kind: 'usage', id: u.id, main: u.method === 'scan' ? 'Stok Keluar (imbas)' : 'Stok Keluar', sub: `${tarikh(u.date)}${u.note ? ` · ${u.note}` : ''}`, right: `−${angka(u.qty)}`, neg: true, ts: Date.parse(u.created_at) });
    for (const a of data.adjustments) rows.push({ kind: 'adjust', id: a.id, main: 'Pelarasan', sub: `${tarikh(a.date)}${a.reason ? ` · ${a.reason}` : ''}`, right: `${a.delta > 0 ? '+' : '−'}${angka(Math.abs(a.delta))}`, neg: a.delta < 0, ts: Date.parse(a.created_at) });
    return rows.sort((x, y) => y.ts - x.ts).slice(0, 25);
  }, [data]);

  // Kad Stok: lejar berjalan mengikut tarikh. Baki awal = stok semasa tolak
  // jumlah pergerakan dalam rekod, supaya baki akhir tepat sama dengan stok semasa.
  const kad = useMemo(() => {
    if (!data) return [];
    type Ev = { date: string; ts: number; desc: string; masuk: number; keluar: number };
    const evs: Ev[] = [];
    for (const p of data.purchases) evs.push({ date: p.date, ts: Date.parse(p.created_at), desc: `Stok Masuk${p.note ? `: ${p.note}` : ''}`, masuk: p.qty, keluar: 0 });
    for (const u of data.usages) evs.push({ date: u.date, ts: Date.parse(u.created_at), desc: `Stok Keluar${u.method === 'scan' ? ' (imbas)' : ''}${u.note ? `: ${u.note}` : ''}`, masuk: 0, keluar: u.qty });
    for (const a of data.adjustments) evs.push({ date: a.date, ts: Date.parse(a.created_at), desc: `Pelarasan${a.reason ? `: ${a.reason}` : ''}`, masuk: a.delta > 0 ? a.delta : 0, keluar: a.delta < 0 ? -a.delta : 0 });
    evs.sort((x, y) => x.date.localeCompare(y.date) || x.ts - y.ts);
    const net = evs.reduce((s, e) => s + e.masuk - e.keluar, 0);
    let baki = data.item.stock - net;
    return evs.map((e) => {
      baki += e.masuk - e.keluar;
      return { ...e, baki };
    });
  }, [data]);

  const item = data?.item;

  // Statistik lanjutan dikira daripada sejarah penuh (100 rekod terkini setiap jenis)
  const stats = useMemo(() => {
    if (!data) return null;
    const since30 = hariDari(-30);
    const uc = data.item.unit_cost;

    let buyQty = 0, buyRm = 0, buyN = 0, buy30 = 0, lastBuy: string | null = null;
    for (const p of data.purchases) {
      const v = p.qty * p.unit_cost;
      buyQty += p.qty; buyRm += v; buyN += 1;
      if (p.date >= since30) buy30 += v;
      if (!lastBuy || p.date > lastBuy) lastBuy = p.date;
    }
    let useQty = 0, useRm = 0, useN = 0, use30 = 0, scanN = 0, lastUse: string | null = null;
    for (const u of data.usages) {
      const cost = u.unit_cost ?? uc; // kos snapshot pada baris penggunaan
      useQty += u.qty; useRm += u.qty * cost; useN += 1;
      if (u.date >= since30) use30 += u.qty * cost;
      if (u.method === 'scan') scanN += 1;
      if (!lastUse || u.date > lastUse) lastUse = u.date;
    }
    let adjQty = 0, adjRm = 0, adjN = 0;
    for (const a of data.adjustments) {
      adjQty += a.delta; adjRm += a.delta * uc; adjN += 1;
    }
    const stockValue = Math.max(0, data.item.stock) * uc;
    return {
      stockValue,
      proj: data.item.projected_monthly_cost,
      buy30, use30,
      buyQty, buyRm, buyN, lastBuy,
      useQty, useRm, useN, scanN, lastUse,
      adjQty, adjRm, adjN,
      avgUnit: buyQty > 0 ? buyRm / buyQty : null,
      scanPct: useN > 0 ? (scanN / useN) * 100 : null,
    };
  }, [data]);

  return (
    <Modal open onClose={onClose} title="Butiran Item" wide>
      {loading && <Spinner />}
      {error && <ErrorState message={error} reload={reload} />}
      {item && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xl font-bold text-bark-900">{item.name}</h4>
              <Badge className={labelStatus(item.status).cls}>{STATUS_LABEL[item.status]}</Badge>
              <Badge className={item.source === 'franchisor' ? 'bg-bark-800 text-cream-100' : 'bg-caramel-400/30 text-coffee-500'}>
                {SOURCE_LABEL[item.source]}
              </Badge>
            </div>
            {item.category && <p className="mt-0.5 text-sm text-bark-700/60">{item.category}</p>}
          </div>

          {/* QR + kod */}
          <div className="flex items-center gap-4 rounded-2xl bg-cream-100 p-4">
            <QRCodeImg value={item.id} size={92} className="rounded-lg bg-white p-1.5 shadow-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-bark-700/60"><QrCode size={13} /> KOD ITEM</div>
              <div className="num mt-0.5 font-mono text-[10px] tracking-wide text-bark-700/35">{item.id}</div>
              <p className="mt-1 text-xs text-bark-700/60">Imbas kod ini untuk merekod penggunaan.</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" className="!min-h-9 !px-3 !text-xs" onClick={() => navigate(`/label/${item.id}`)}>
                  <Printer size={14} /> Cetak Label
                </Button>
              </div>
            </div>
          </div>

          {/* Statistik utama */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-3.5">
              <div className="text-xs font-semibold text-bark-700/60">STOK SEMASA</div>
              <div className={`num mt-1 text-lg font-extrabold ${item.status === 'habis' ? 'text-berry-600' : 'text-bark-900'}`}>
                {angka(item.stock)} <span className="text-xs font-medium text-bark-700/60">{item.unit}</span>
              </div>
            </Card>
            <Card className="p-3.5">
              <div className="text-xs font-semibold text-bark-700/60">STOK MINIMUM</div>
              <div className="num mt-1 text-lg font-extrabold text-bark-900">
                {angka(item.min_qty)} <span className="text-xs font-medium text-bark-700/60">{item.unit}</span>
              </div>
            </Card>
            <Card className="p-3.5">
              <div className="text-xs font-semibold text-bark-700/60">KOS SEUNIT</div>
              <div className="num mt-1 text-lg font-extrabold text-bark-900">{rm(item.unit_cost)}</div>
            </Card>
            <Card className="p-3.5">
              <div className="text-xs font-semibold text-bark-700/60">BAKI STOK</div>
              <div className="num mt-1 text-lg font-extrabold text-bark-900">{hariBerbaki(item.days_left)}</div>
              <div className="text-[11px] text-bark-700/60">purata {angka(Math.round(item.daily_rate * 1000) / 1000)} {item.unit}/hari</div>
            </Card>
          </div>

          {/* Statistik kewangan (30 hari) */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="p-3.5">
                <div className="text-xs font-semibold text-bark-700/60">NILAI STOK SEMASA</div>
                <div className="num mt-1 text-lg font-extrabold text-bark-900">{rm(stats.stockValue)}</div>
                <div className="text-[11px] text-bark-700/60">stok × kos seunit</div>
              </Card>
              <Card className="p-3.5">
                <div className="text-xs font-semibold text-bark-700/60">UNJURAN / BULAN</div>
                <div className="num mt-1 text-lg font-extrabold text-bark-900">{stats.proj > 0 ? rm(stats.proj) : '-'}</div>
                <div className="text-[11px] text-bark-700/60">30 hari akan datang</div>
              </Card>
              <Card className="p-3.5">
                <div className="text-xs font-semibold text-bark-700/60">BELANJA (30 HARI)</div>
                <div className="num mt-1 text-lg font-extrabold text-bark-900">{rm(stats.buy30)}</div>
                <div className="text-[11px] text-bark-700/60">jumlah pembelian</div>
              </Card>
              <Card className="p-3.5">
                <div className="text-xs font-semibold text-bark-700/60">DIGUNA (30 HARI)</div>
                <div className="num mt-1 text-lg font-extrabold text-bark-900">{rm(stats.use30)}</div>
                <div className="text-[11px] text-bark-700/60">
                  {stats.buy30 > 0 ? `${Math.round((stats.use30 / stats.buy30) * 100)}% daripada belanja` : 'kos penggunaan'}
                </div>
              </Card>
            </div>
          )}

          {/* Ringkasan sepanjang rekod */}
          {stats && (
            <Card className="overflow-hidden">
              <div className="border-b border-cream-200 px-4 py-3">
                <h3 className="font-bold text-bark-900">Ringkasan Sepanjang Rekod</h3>
                <p className="text-xs text-bark-700/60">Berdasarkan 100 rekod terkini setiap jenis pergerakan</p>
              </div>
              <div className="divide-y divide-cream-100 text-sm">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center bg-leaf-100 text-leaf-700"><PackagePlus size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-bark-900">Dibeli</span>
                    <span className="num block text-xs text-bark-700/60">
                      {stats.buyN} rekod{stats.lastBuy ? ` · terakhir ${tarikh(stats.lastBuy)}` : ''}
                    </span>
                  </span>
                  <span className="num text-right">
                    <span className="block text-[15px] font-bold text-bark-900">{angka(stats.buyQty)} {item.unit}</span>
                    <span className="block text-[11px] text-bark-700/60">{rm(stats.buyRm)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center bg-cream-200 text-coffee-500"><PackageMinus size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-bark-900">Digunakan</span>
                    <span className="num block text-xs text-bark-700/60">
                      {stats.useN} rekod{stats.lastUse ? ` · terakhir ${tarikh(stats.lastUse)}` : ''}{stats.scanPct !== null ? ` · ${Math.round(stats.scanPct)}% imbasan` : ''}
                    </span>
                  </span>
                  <span className="num text-right">
                    <span className="block text-[15px] font-bold text-bark-900">{angka(stats.useQty)} {item.unit}</span>
                    <span className="block text-[11px] text-bark-700/60">{rm(stats.useRm)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center bg-cream-200 text-bark-700"><SlidersHorizontal size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-bark-900">Pelarasan bersih</span>
                    <span className="num block text-xs text-bark-700/60">{stats.adjN} rekod</span>
                  </span>
                  <span className="num text-right">
                    <span className={`block text-[15px] font-bold ${stats.adjQty < 0 ? 'text-berry-600' : 'text-bark-900'}`}>
                      {stats.adjQty > 0 ? '+' : '−'}{angka(Math.abs(stats.adjQty))} {item.unit}
                    </span>
                    <span className="block text-[11px] text-bark-700/60">{rm(Math.abs(stats.adjRm))}</span>
                  </span>
                </div>
                {stats.avgUnit !== null && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center bg-cream-200 text-bark-700"><Wallet size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-bark-900">Kos seunit purata sebenar</span>
                      <span className="block text-xs text-bark-700/60">jumlah dibeli ÷ jumlah kuantiti</span>
                    </span>
                    <span className="num text-right text-[15px] font-bold text-bark-900">
                      {rm(stats.avgUnit)}
                      {stats.avgUnit > item.unit_cost && <span className="block text-[11px] font-medium text-berry-600">kos semasa {rm(item.unit_cost)} lebih rendah</span>}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {item.note && <p className="rounded-xl bg-cream-100 px-4 py-3 text-sm text-bark-700">📝 {item.note}</p>}

          {/* Tindakan */}
          <div className="grid grid-cols-3 gap-2.5">
            <Button onClick={() => setMove('purchase')} className="!bg-leaf-700 hover:!bg-leaf-600"><PackagePlus size={17} /> Masuk</Button>
            <Button variant="secondary" onClick={() => setMove('usage')}><PackageMinus size={17} /> Keluar</Button>
            <Button variant="secondary" onClick={() => setMove('adjust')}><SlidersHorizontal size={17} /> Laras</Button>
          </div>

          {/* Kad Stok / Sejarah */}
          <div>
            <SectionTitle>Rekod Pergerakan</SectionTitle>
            <div className="mb-2.5 flex gap-1.5">
              {(['kad', 'senarai'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={tab === t ? 'bg-coffee-500 px-3.5 py-1.5 text-xs font-bold text-white' : 'bg-cream-100 px-3.5 py-1.5 text-xs font-semibold text-bark-700 hover:bg-cream-200'}
                >
                  {t === 'kad' ? 'Kad Stok' : 'Senarai'}
                </button>
              ))}
            </div>
            {tab === 'kad' ? (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-coffee-500 bg-coffee-500/5 px-4 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-coffee-500">Kad Stok</div>
                    <div className="text-sm font-bold text-bark-900">{item.name}</div>
                  </div>
                  <div className="num text-right text-[11px] leading-4 text-bark-700/60">
                    <div>Kod: <span className="font-mono text-[10px]">{item.id}</span></div>
                    <div>Unit: {item.unit} · Min: {angka(item.min_qty)}</div>
                  </div>
                </div>
                {kad.length === 0 ? (
                  <p className="py-4 text-center text-sm text-bark-700/50">Tiada rekod lagi.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-cream-200 text-[11px] uppercase tracking-wide text-bark-800">
                          <th className="border border-cream-300 px-3 py-2 text-left font-bold">Tarikh</th>
                          <th className="border border-cream-300 px-3 py-2 text-left font-bold">Butiran</th>
                          <th className="num border border-cream-300 px-3 py-2 text-right font-bold">Masuk</th>
                          <th className="num border border-cream-300 px-3 py-2 text-right font-bold">Keluar</th>
                          <th className="num border border-cream-300 px-3 py-2 text-right font-bold">Baki ({item.unit})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const k0 = kad[0];
                          const bakiAwal = k0.baki - k0.masuk + k0.keluar;
                          return (
                            <tr className="bg-cream-100/70">
                              <td className="border border-cream-300 px-3 py-2 text-bark-700/60" colSpan={4}>Baki dibawa ke hadapan</td>
                              <td className="num border border-cream-300 px-3 py-2 text-right font-bold text-bark-900">{angka(bakiAwal)}</td>
                            </tr>
                          );
                        })()}
                        {kad.map((k, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-cream-100/40' : ''}>
                            <td className="num whitespace-nowrap border border-cream-300 px-3 py-2 text-bark-700">{tarikh(k.date)}</td>
                            <td className="border border-cream-300 px-3 py-2 text-bark-900">{k.desc}</td>
                            <td className="num whitespace-nowrap border border-cream-300 px-3 py-2 text-right font-semibold text-leaf-700">{k.masuk > 0 ? `+${angka(k.masuk)}` : ''}</td>
                            <td className="num whitespace-nowrap border border-cream-300 px-3 py-2 text-right font-semibold text-berry-600">{k.keluar > 0 ? `-${angka(k.keluar)}` : ''}</td>
                            <td className="num whitespace-nowrap border border-cream-300 px-3 py-2 text-right font-bold text-bark-900">{angka(k.baki)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-cream-200/80 font-bold">
                          <td className="border border-coffee-500 px-3 py-2.5 text-bark-900" colSpan={2}>Jumlah</td>
                          <td className="num border border-coffee-500 px-3 py-2.5 text-right text-leaf-700">+{angka(kad.reduce((s, k) => s + k.masuk, 0))}</td>
                          <td className="num border border-coffee-500 px-3 py-2.5 text-right text-berry-600">-{angka(kad.reduce((s, k) => s + k.keluar, 0))}</td>
                          <td className="num border border-coffee-500 px-3 py-2.5 text-right text-bark-900">{angka(item.stock)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="border-t border-cream-200 px-4 py-3 text-[11px] text-bark-700/50">Baki akhir sentiasa sama dengan stok semasa ({angka(item.stock)} {item.unit}).</p>
              </Card>
            ) : (
              <Card className="divide-y divide-cream-100 px-4">
                {history.length === 0 && <p className="py-4 text-center text-sm text-bark-700/50">Tiada rekod lagi.</p>}
                {history.map((h, i) => (
                  <HistoryRow
                    key={`${h.kind}-${h.id}-${i}`}
                    icon={h.kind === 'purchase' ? <PackagePlus size={15} /> : h.kind === 'usage' ? <PackageMinus size={15} /> : <SlidersHorizontal size={15} />}
                    cls={h.kind === 'purchase' ? 'bg-leaf-100 text-leaf-700' : h.kind === 'usage' ? 'bg-cream-200 text-coffee-500' : 'bg-cream-200 text-bark-700'}
                    main={h.main}
                    sub={h.sub}
                    right={h.right}
                  />
                ))}
              </Card>
            )}
          </div>

          {/* Sunting / padam */}
          <div className="flex gap-2.5 border-t border-cream-200 pt-4">
            <Button variant="secondary" onClick={() => setEdit(true)}><Pencil size={16} /> Sunting</Button>
            <Button variant="danger" onClick={() => setConfirmDel(true)}><Trash2 size={16} /> Padam</Button>
          </div>
        </div>
      )}

      {item && move && (
        <MovementModal kind={move} item={item} onClose={() => setMove(null)} onSaved={() => { reload(); onChanged(); }} />
      )}
      {item && edit && (
        <ItemFormModal open item={item} onClose={() => setEdit(false)} onSaved={() => { reload(); onChanged(); }} />
      )}
      {item && (
        <ConfirmModal
          open={confirmDel}
          title="Padam Item?"
          message={`"${item.name}" akan dipadam daripada senarai. Sejarah pembelian dan penggunaan turut tidak dipaparkan lagi.`}
          confirmLabel="Padam"
          onCancel={() => setConfirmDel(false)}
          onConfirm={del}
        />
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ Senarai

type Chip = 'all' | 'franchisor' | 'local' | 'low';

const CHIPS: { value: Chip; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'franchisor', label: 'Francais' },
  { value: 'local', label: 'Tempatan' },
  { value: 'low', label: 'Perlu Dipesan' },
];

export default function Inventory() {
  // Parameter hash: ?filter=low, ?item=<id> (deep-link dari Dashboard dsb.)
  const qi = window.location.hash.indexOf('?');
  const urlParams = new URLSearchParams(qi === -1 ? '' : window.location.hash.slice(qi + 1));
  const [chip, setChip] = useState<Chip>(urlParams.get('filter') === 'low' ? 'low' : 'all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (dq.trim()) params.set('q', dq.trim());
    if (chip === 'franchisor' || chip === 'local') params.set('source', chip);
    if (chip === 'low') params.set('filter', 'low');
    const s = params.toString();
    return `/api/items${s ? `?${s}` : ''}`;
  }, [dq, chip]);

  const { data, loading, error, reload } = useApi<{ items: ItemWithStock[] }>(url);
  const [detailId, setDetailId] = useState<string | null>(urlParams.get('item'));
  const [adding, setAdding] = useState(false);

  /** Tutup butiran + buang parameter ?item= supaya muat semula tidak membukanya lagi */
  function closeDetail() {
    setDetailId(null);
    if (window.location.hash.includes('?')) {
      history.replaceState(null, '', `${location.pathname}${location.search}#/inventori`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Carian + tindakan */}
      <div className="flex gap-2.5">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-700/40" />
          <input
            className={`${inputCls} !pl-10`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari item"
          />
        </div>
        <Button onClick={() => navigate('/label')} variant="secondary" className="!px-3.5 shrink-0" aria-label="Cetak label pukal">
          <Printer size={18} />
          <span className="hidden md:inline">Cetak Pukal</span>
        </Button>
        <Button onClick={() => setAdding(true)} className="!px-3.5 shrink-0" aria-label="Tambah item">
          <Plus size={19} />
          <span className="hidden md:inline">Tambah Item</span>
        </Button>
      </div>

      {/* Cip tapis */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => setChip(c.value)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              chip === c.value ? 'bg-bark-800 text-cream-50' : 'bg-white text-bark-700 border border-cream-300 hover:bg-cream-100'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Senarai */}
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} reload={reload} />
      ) : !data || data.items.length === 0 ? (
        chip === 'low' && !q ? (
          <EmptyState
            icon={<CheckCircle2 size={24} />}
            title="Semua stok mencukupi 👍"
            message="Tiada item yang perlu dipesan buat masa ini."
          />
        ) : (
          <EmptyState
            icon={<Plus size={24} />}
            title={q ? 'Tiada padanan' : chip === 'all' ? 'Belum ada item' : chip === 'low' ? 'Perlu Dipesan' : `Tiada item ${SOURCE_LABEL[chip].toLowerCase()}`}
            message={
              q
                ? `Tiada item sepadan dengan "${q}".`
                : chip === 'all'
                  ? 'Mulakan dengan menambah item pertama kedai kopi anda.'
                  : 'Tambah item jika anda mahu merekodnya dalam inventori.'
            }
            action={!q && <Button onClick={() => setAdding(true)}><Plus size={17} /> Tambah Item</Button>}
          />
        )
      ) : (
        <Card className="divide-y divide-cream-100">
          {data.items.map((it) => {
            const st = labelStatus(it.status);
            return (
              <button key={it.id} onClick={() => setDetailId(it.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-cream-100/60 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-bark-900">{it.name}</div>
                  <div className="truncate text-xs text-bark-700/60">
                    {SOURCE_LABEL[it.source]}
                    {it.category ? ` · ${it.category}` : ''}
                    {it.min_qty > 0 ? ` · min ${angka(it.min_qty)} ${it.unit}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <div className={`num text-[15px] font-bold ${it.status === 'habis' ? 'text-berry-600' : it.status === 'rendah' ? 'text-amber-warn' : 'text-bark-900'}`}>
                      {angka(it.stock)} <span className="text-xs font-medium text-bark-700/60">{it.unit}</span>
                    </div>
                    <Badge className={st.cls}>{st.label}</Badge>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-bark-700/30" />
                </div>
              </button>
            );
          })}
        </Card>
      )}

      <ItemFormModal open={adding} item={null} onClose={() => setAdding(false)} onSaved={reload} />
      {detailId && <ItemDetailModal itemId={detailId} onClose={closeDetail} onChanged={reload} />}
    </div>
  );
}
