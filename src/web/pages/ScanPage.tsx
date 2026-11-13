import { useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CameraOff, PackageMinus, PackagePlus, ScanLine, Search } from 'lucide-react';
import { api } from '../api';
import { angka, hariIni, rm } from '../format';
import { Button, Card, Field, inputCls, Modal, Segmented, toast } from '../ui';
import { ItemPickerField } from './ItemPicker';
import type { ItemWithStock } from '../../shared/types';

type Mode = 'usage' | 'purchase';

function ConfirmCard({ item, method, onDone, onCancel }: {
  item: ItemWithStock;
  method: 'scan' | 'manual';
  onDone: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('usage');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState(String(item.unit_cost));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const q = parseFloat(qty);
    if (!q || q <= 0) {
      toast('Kuantiti mesti melebihi sifar', 'error');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'usage') {
        await api.post('/api/usages', { item_id: item.id, qty: q, date: hariIni(), method, note });
        toast(`Penggunaan direkod: ${angka(q)} ${item.unit} ${item.name}`);
      } else {
        await api.post('/api/purchases', { item_id: item.id, qty: q, unit_cost: parseFloat(cost) || 0, date: hariIni(), note });
        toast(`Stok masuk direkod: ${angka(q)} ${item.unit} ${item.name}`);
      }
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-cream-100 p-4">
        <div className="text-[15px] font-bold text-bark-900">{item.name}</div>
        <div className="num mt-0.5 text-sm text-bark-700/70">
          Stok semasa: <b className="text-bark-900">{angka(item.stock)} {item.unit}</b>
        </div>
      </div>

      <Segmented
        value={mode}
        onChange={(v) => setMode(v)}
        options={[
          { value: 'usage', label: 'Stok Keluar (guna)' },
          { value: 'purchase', label: 'Stok Masuk (beli)' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kuantiti">
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setQty((v) => String(Math.max(0.01, (parseFloat(v) || 0) - 1)))}
              className="w-11 shrink-0 rounded-xl border border-cream-300 bg-white text-lg font-bold text-bark-800 hover:bg-cream-100"
              aria-label="Kurangkan"
            >−</button>
            <input className={`${inputCls} num text-center`} type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
            <button
              type="button"
              onClick={() => setQty((v) => String((parseFloat(v) || 0) + 1))}
              className="w-11 shrink-0 rounded-xl border border-cream-300 bg-white text-lg font-bold text-bark-800 hover:bg-cream-100"
              aria-label="Tambah"
            >+</button>
          </div>
        </Field>
        {mode === 'purchase' && (
          <Field label="Kos Seunit (RM)">
            <input className={`${inputCls} num`} type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
      </div>

      {mode === 'purchase' && (
        <div className="num rounded-xl bg-cream-100 px-4 py-3 text-sm text-bark-700">
          Jumlah: <b className="text-bark-900">{rm((parseFloat(qty) || 0) * (parseFloat(cost) || 0))}</b>
        </div>
      )}

      <Field label="Nota">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="pilihan" />
      </Field>

      <div className="flex gap-3">
        <Button variant="secondary" full onClick={onCancel}>Batal</Button>
        <Button full onClick={save} disabled={saving}>
          {mode === 'usage' ? <><PackageMinus size={17} /> Sahkan Keluar</> : <><PackagePlus size={17} /> Sahkan Masuk</>}
        </Button>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [cameraOk, setCameraOk] = useState<boolean | null>(null); // null = memeriksa
  const [foundItem, setFoundItem] = useState<ItemWithStock | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [manualItem, setManualItem] = useState<ItemWithStock | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const lastScan = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const lookup = useCallback(async (text: string) => {
    // Nyahkod nilai yang mungkin datang daripada URL atau kod lain
    let id = text.trim();
    const m = id.match(/(?:SG-[A-Z2-9]{8})/i);
    if (m) id = m[0].toUpperCase();
    if (!/^SG-[A-Z2-9]{8}$/i.test(id)) {
      setNotFound(id);
      return;
    }
    try {
      const res = await api.get<{ items: ItemWithStock[] }>(`/api/items?q=${encodeURIComponent(id)}`);
      const hit = res.items.find((i) => i.id.toUpperCase() === id.toUpperCase());
      if (hit) {
        setFoundItem(hit);
      } else {
        setNotFound(id);
      }
    } catch {
      setNotFound(id);
    }
  }, []);

  const onScan = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastScan.current.text === text && now - lastScan.current.at < 2500) return;
      lastScan.current = { text, at: now };
      navigator.vibrate?.(80);
      void lookup(text);
    },
    [lookup]
  );

  // Mulakan kamera
  useEffect(() => {
    let cancelled = false;
    let scanner: QrScanner | null = null;
    async function start() {
      if (!videoRef.current) return;
      if (!('mediaDevices' in navigator) || !window.isSecureContext) {
        setCameraOk(false);
        return;
      }
      try {
        scanner = new QrScanner(videoRef.current, (r) => onScan(r.data ?? r), {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 8,
        });
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setCameraOk(true);
      } catch {
        if (!cancelled) setCameraOk(false);
      }
    }
    void start();
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [onScan]);

  // Hentikan imbasan sementara borang pengesahan dibuka
  useEffect(() => {
    if (foundItem || manualItem) {
      scannerRef.current?.stop();
    } else if (cameraOk) {
      void scannerRef.current?.start().catch(() => {});
    }
  }, [foundItem, manualItem, cameraOk]);

  function reset() {
    setFoundItem(null);
    setNotFound(null);
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-bark-700/70">
        Halakan kamera ke kod QR pada item untuk merekod <b>stok keluar</b> (penggunaan) atau <b>stok masuk</b> (pembelian).
      </p>

      {/* Kamera */}
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-bark-950 aspect-square shadow-lg">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {cameraOk === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream-50/70">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-cream-50/20 border-t-caramel-400" />
            <span className="text-sm">Menghidupkan kamera…</span>
          </div>
        )}
        {cameraOk === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-cream-50/80">
            <CameraOff size={34} />
            <span className="text-sm font-semibold">Kamera tidak tersedia</span>
            <span className="text-xs leading-relaxed text-cream-50/60">
              Beri kebenaran kamera pada pelayar, atau gunakan borang manual di bawah.
              (Kamera memerlukan sambungan selamat HTTPS.)
            </span>
          </div>
        )}
        {/* Bingkai panduan */}
        {cameraOk === true && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-2xl border-2 border-cream-50/70 shadow-[0_0_0_9999px_rgba(36,26,18,0.35)]" />
          </div>
        )}
      </div>

      {/* Borang manual */}
      <Card className="p-4">
        <button onClick={() => setManualOpen((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-200 text-coffee-500">
            <Search size={17} />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-bark-900">Isi Borang Manual</div>
            <div className="text-xs text-bark-700/60">Rekod tanpa mengimbas kod</div>
          </div>
        </button>

        {manualOpen && !manualItem && (
          <div className="mt-4">
            <ItemPickerField label="Item" item={manualItem} onPick={setManualItem} />
          </div>
        )}

        {manualOpen && manualItem && (
          <div className="mt-4">
            <ConfirmCard item={manualItem} method="manual" onDone={() => { setManualItem(null); setManualOpen(false); }} onCancel={() => setManualItem(null)} />
          </div>
        )}
      </Card>

      {/* Modal pengesahan imbasan */}
      <Modal open={!!foundItem} onClose={reset} title="Item Dijumpai">
        {foundItem && (
          <ConfirmCard
            item={foundItem}
            method="scan"
            onDone={reset}
            onCancel={reset}
          />
        )}
      </Modal>

      {/* Kod tidak dikenali */}
      <Modal open={!!notFound} onClose={reset} title="Kod Tidak Dikenali">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-berry-soft text-berry-600">
            <ScanLine size={24} />
          </div>
          <p className="text-[15px] text-bark-800">
            Kod <span className="num font-mono font-bold">{notFound}</span> tidak sepadan dengan mana-mana item dalam inventori anda.
          </p>
          <p className="text-sm text-bark-700/60">Pastikan label dipadam dengan kod item yang betul, atau tambah item baharu dahulu.</p>
          <Button full onClick={reset}>Imbas Semula</Button>
        </div>
      </Modal>
    </div>
  );
}
