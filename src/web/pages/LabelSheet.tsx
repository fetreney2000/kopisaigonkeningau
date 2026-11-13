import { useMemo, useState } from 'react';
import { Printer, Scissors, Minus, Plus } from 'lucide-react';
import { useApi } from '../api';
import { SOURCE_LABEL } from '../format';
import { Button, Card, ErrorState, Segmented, Spinner } from '../ui';
import QRCodeImg from './QRCodeImg';
import type { ItemWithStock, Source } from '../../shared/types';

// ------------------------------------------------------------------ preset susun atur (mm)

interface Preset {
  key: string;
  label: string;
  note: string;
  cols: number;
  rows: number;
  cellW: number;   // mm
  cellH: number;   // mm
  gap: number;     // mm
  /** padding helaian (mm) - [atas, kanan, bawah, kiri] */
  pad: [number, number, number, number];
  qrMm: number;
  layout: 'vertical' | 'horizontal';
}

// A4 = 210 x 297 mm. Kawasan cetakan selamat >= 10mm dari tepi kertas.
// Semua grid di bawah muat dalam 190 x 277 mm (A4 tolak margin 10mm setiap sisi).
const PRESETS: Preset[] = [
  {
    key: 'giant', label: 'Gergasi', note: '4 label / lembar, bekas sangat besar',
    cols: 2, rows: 2, cellW: 92.5, cellH: 130, gap: 5, pad: [10, 10, 10, 10], qrMm: 46, layout: 'vertical',
  },
  {
    key: 'big', label: 'Besar', note: '8 label / lembar, bekas besar',
    cols: 2, rows: 4, cellW: 92.5, cellH: 64, gap: 5, pad: [10, 10, 10, 10], qrMm: 32, layout: 'vertical',
  },
  {
    key: 'normal', label: 'Biasa', note: '15 label / lembar, kegunaan harian',
    cols: 3, rows: 5, cellW: 60.6, cellH: 52, gap: 4, pad: [10, 10, 10, 10], qrMm: 26, layout: 'vertical',
  },
  {
    key: 'medium', label: 'Sederhana', note: '18 label / lembar, grid 3 × 6',
    cols: 3, rows: 6, cellW: 60.6, cellH: 42.5, gap: 4, pad: [10, 10, 10, 10], qrMm: 23, layout: 'vertical',
  },
  {
    key: 'compact', label: 'Padat', note: '24 label / lembar, grid 4 × 6',
    cols: 4, rows: 6, cellW: 44.5, cellH: 43.5, gap: 3, pad: [10, 10, 10, 10], qrMm: 20, layout: 'horizontal',
  },
  {
    key: 'small', label: 'Kecil', note: '45 label / lembar, bekas kecil (imbas dekat)',
    cols: 5, rows: 9, cellW: 35.6, cellH: 27.9, gap: 3, pad: [10, 10, 10, 10], qrMm: 17, layout: 'horizontal',
  },
];

// ------------------------------------------------------------------ sel label

function LabelCell({ item, preset, cutLines }: { item: ItemWithStock; preset: Preset; cutLines: boolean }) {
  const px = Math.round(preset.qrMm * 3.78); // 1mm ≈ 3.78px pada skrin
  const nameSize = preset.layout === 'horizontal'
    ? (preset.key === 'small' ? '2.5mm' : '2.9mm')
    : (preset.key === 'giant' ? '4.5mm' : '3.4mm');

  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-white ${preset.layout === 'horizontal' ? 'gap-2' : 'flex-col gap-1'}`}
      style={{
        padding: preset.layout === 'horizontal' ? '1.5mm' : '2.5mm',
        border: cutLines ? '0.25mm dashed #b8b2a8' : undefined,
        width: `${preset.cellW}mm`,
        height: `${preset.cellH}mm`,
      }}
    >
      <QRCodeImg value={item.id} size={px} margin={3} className="shrink-0" />
      <div className={`min-w-0 ${preset.layout === 'horizontal' ? 'flex-1' : 'text-center'}`}>
        <div
          className="font-extrabold leading-tight text-bark-900"
          style={{ fontSize: nameSize, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {item.name}
        </div>
        {preset.layout === 'vertical' && (
          <div className="text-bark-700/70" style={{ fontSize: '1.7mm' }}>Imbas untuk merekod stok{item.unit ? ` · ${item.unit}` : ''}</div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ halaman

type Chip = 'all' | 'franchisor' | 'local';

export default function LabelSheet() {
  const { data, loading, error, reload } = useApi<{ items: ItemWithStock[] }>('/api/items');
  const [presetKey, setPresetKey] = useState('normal');
  const [cutLines, setCutLines] = useState(true);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  /** id item → bilangan salinan */
  const [selected, setSelected] = useState<Record<string, number>>({});

  const preset = PRESETS.find((p) => p.key === presetKey)!;
  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    let list = items;
    const ql = q.trim().toLowerCase();
    if (ql) list = list.filter((i) => i.name.toLowerCase().includes(ql) || i.id.toLowerCase().includes(ql));
    if (chip !== 'all') list = list.filter((i) => i.source === chip);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, q, chip]);

  const cells = useMemo(() => {
    const out: ItemWithStock[] = [];
    for (const it of items) {
      const copies = selected[it.id];
      if (copies) for (let c = 0; c < copies; c++) out.push(it);
    }
    return out;
  }, [items, selected]);

  const perSheet = preset.cols * preset.rows;
  const pages = Math.max(1, Math.ceil(cells.length / perSheet));

  function toggle(id: string) {
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function setCopies(id: string, n: number) {
    setSelected((s) => ({ ...s, [id]: Math.max(1, Math.min(50, n)) }));
  }

  const allSelected = filtered.length > 0 && filtered.every((i) => selected[i.id]);

  function selectAll() {
    setSelected((s) => {
      const next = { ...s };
      if (allSelected) {
        for (const i of filtered) delete next[i.id];
      } else {
        for (const i of filtered) if (!next[i.id]) next[i.id] = 1;
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Kawalan (tidak dicetak) */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-bark-900">Cetak Label Pukal</h2>
            <p className="text-sm text-bark-700/70">Pilih item, bilangan salinan, dan susun atur helaian.</p>
          </div>
          <Button onClick={() => window.print()} disabled={cells.length === 0}>
            <Printer size={17} /> Cetak {cells.length > 0 ? `(${pages} lembar)` : ''}
          </Button>
        </div>

        {/* Susun atur + garis potong */}
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-bark-800">Susun Atur Helaian</span>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPresetKey(p.key)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      presetKey === p.key ? 'border-bark-800 bg-cream-100' : 'border-cream-300 bg-white hover:bg-cream-100/50'
                    }`}
                  >
                    <div className="text-sm font-bold text-bark-900">{p.label}</div>
                    <div className="text-[11px] leading-tight text-bark-700/70">{p.note}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setCutLines((v) => !v)}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                  cutLines ? 'border-bark-800 bg-cream-100 text-bark-900' : 'border-cream-300 bg-white text-bark-700'
                }`}
              >
                <Scissors size={16} /> Garis potong {cutLines ? 'aktif' : 'tiada'}
              </button>
            </div>
          </div>
        </Card>

        {/* Pemilihan item */}
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-bark-800">Pilih Item</span>
            <button onClick={selectAll} className="text-xs font-semibold text-coffee-500 hover:underline" disabled={filtered.length === 0}>
              {allSelected ? 'Kosongkan Semua' : 'Pilih Semua (dipapar)'}
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <input
              className="w-full rounded-xl border border-cream-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-coffee-500 focus:outline-2 focus:outline-coffee-500/25"
              aria-label="Cari item"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex shrink-0 gap-1.5">
              {([['all', 'Semua'], ['franchisor', 'Francais'], ['local', 'Tempatan']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setChip(v)}
                  className={`rounded-full px-3 text-xs font-semibold transition-colors ${
                    chip === v ? 'bg-bark-800 text-cream-50' : 'bg-cream-200 text-bark-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <Spinner className="!py-6" />
          ) : error ? (
            <ErrorState message={error} reload={reload} />
          ) : (
            <div className="max-h-72 divide-y divide-cream-100 overflow-y-auto rounded-xl border border-cream-200">
              {filtered.length === 0 && <p className="py-4 text-center text-sm text-bark-700/50">Tiada item dijumpai.</p>}
              {filtered.map((it) => {
                const sel = selected[it.id];
                return (
                  <div key={it.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={!!sel} onChange={() => toggle(it.id)} className="h-5 w-5 accent-[#3e2a1a]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-bark-900">{it.name}</span>
                        <span className="block text-[10px] text-bark-700/40">{SOURCE_LABEL[it.source]}<span className="num ml-1.5 font-mono">{it.id}</span></span>
                      </span>
                    </label>
                    {sel && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => setCopies(it.id, sel - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-cream-300 bg-white hover:bg-cream-100" aria-label="Kurangkan salinan">
                          <Minus size={14} />
                        </button>
                        <span className="num w-8 text-center text-sm font-bold text-bark-900">{sel}</span>
                        <button onClick={() => setCopies(it.id, sel + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-cream-300 bg-white hover:bg-cream-100" aria-label="Tambah salinan">
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-sm text-bark-700/70">
            <b className="text-bark-900">{cells.length}</b> label · <b className="text-bark-900">{pages}</b> lembar A4 ({perSheet}/lembar)
          </p>
        </Card>

        {/* Petua cetak */}
        <Card className="p-4 text-xs leading-relaxed text-bark-700/80">
          <b className="text-bark-900">Sebelum mencetak:</b> dalam dialog cetak pilih kertas <b>A4</b>, skala <b>100%</b>,
          margin <b>Lalai</b>, dan matikan <b>Header &amp; Footer</b>. Kod QR pada helaian ini berukuran{' '}
          <b>{preset.qrMm} mm</b> dengan ruang lega (quiet zone), imbas dari 15-30 cm.{' '}
          <b className="text-amber-warn">Uji cetak 1 lembar dan imbas dahulu</b> sebelum mencetak banyak.
        </Card>
      </div>

      {/* Pratonton / kawasan cetakan */}
      <div className="overflow-x-auto pb-2">
        {cells.length === 0 ? (
          <Card className="no-print px-6 py-10 text-center text-sm text-bark-700/60">
            Pilih item di atas untuk melihat pratonton helaian label.
          </Card>
        ) : (
          Array.from({ length: pages }, (_, p) => (
            <div
              key={p}
              className="sheet mx-auto mb-6 bg-white shadow-lg"
              style={{
                width: '210mm',
                height: '297mm',
                paddingTop: `${preset.pad[0]}mm`,
                paddingRight: `${preset.pad[1]}mm`,
                paddingBottom: `${preset.pad[2]}mm`,
                paddingLeft: `${preset.pad[3]}mm`,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${preset.cols}, ${preset.cellW}mm)`,
                  gridAutoRows: `${preset.cellH}mm`,
                  gap: `${preset.gap}mm`,
                  alignContent: 'start',
                  justifyContent: 'start',
                }}
              >
                {cells.slice(p * perSheet, (p + 1) * perSheet).map((it, i) => (
                  <LabelCell key={`${it.id}-${p}-${i}`} item={it} preset={preset} cutLines={cutLines} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
