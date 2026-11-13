// Pemformatan ikut ms-MY — Ringgit Malaysia (RM), waktu Kuala Lumpur (UTC+8)

const KL_OFFSET_MS = 8 * 3600_000;

const moneyFmt = new Intl.NumberFormat('ms-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyCompactFmt = new Intl.NumberFormat('ms-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat('ms-MY', { maximumFractionDigits: 2 });

const monthFmt = new Intl.DateTimeFormat('ms-MY', { month: 'long', year: 'numeric' });

export function rm(v: number): string {
  return moneyFmt.format(v || 0);
}

/** RM tanpa sen untuk angka besar pada kad ringkasan */
export function rmShort(v: number): string {
  return Math.abs(v) >= 10000 ? moneyCompactFmt.format(v || 0) : moneyFmt.format(v || 0);
}

export function angka(v: number): string {
  return numFmt.format(v || 0);
}

/** RM berformat "RM1,234.56" untuk carta */
export function rmPlain(v: number): string {
  return 'RM' + numFmt.format(Math.round((v || 0) * 100) / 100);
}

/** Tarikh format Malaysia dd-mm-yyyy; terima 'YYYY-MM-DD' atau ISO penuh (dilaraskan ke waktu KL) */
export function tarikh(iso: string): string {
  if (!iso) return '';
  const day = iso.length === 10 ? iso : new Date(new Date(iso).getTime() + KL_OFFSET_MS).toISOString().slice(0, 10);
  const [y, m, d] = day.split('-');
  return `${d}-${m}-${y}`;
}

export function bulan(ym: string): string {
  const d = new Date(ym + '-01T00:00:00');
  return monthFmt.format(d);
}

/** Tarikh hari ini ikut waktu Kuala Lumpur (UTC+8), format YYYY-MM-DD */
export function hariIni(): string {
  return new Date(Date.now() + KL_OFFSET_MS).toISOString().slice(0, 10);
}

export function hariDari(offsetDays: number): string {
  return new Date(Date.now() + KL_OFFSET_MS + offsetDays * 86400_000).toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ status stok

export type StockStatus = 'habis' | 'rendah' | 'hampir' | 'ok';

export function statusOf(stock: number, minQty: number): StockStatus {
  if (stock <= 0) return 'habis';
  if (minQty > 0 && stock <= minQty) return 'rendah';
  if (minQty > 0 && stock <= minQty * 1.2) return 'hampir';
  return 'ok';
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  habis: 'Habis',
  rendah: 'Stok Rendah',
  hampir: 'Hampir Rendah',
  ok: 'Cukup',
};

export const SOURCE_LABEL: Record<'franchisor' | 'local', string> = {
  franchisor: 'Francais',
  local: 'Tempatan',
};

export function labelStatus(s: StockStatus) {
  switch (s) {
    case 'habis':
      return { label: STATUS_LABEL[s], cls: 'bg-berry-soft text-berry-600' };
    case 'rendah':
      return { label: STATUS_LABEL[s], cls: 'bg-amber-soft text-amber-warn' };
    case 'hampir':
      return { label: STATUS_LABEL[s], cls: 'bg-cream-200 text-bark-700' };
    default:
      return { label: STATUS_LABEL[s], cls: 'bg-leaf-100 text-leaf-700' };
  }
}

/** Nama bulan pendek ikut ms-MY: Jan, Feb, Mac ... */
export function bulanPendek(ym: string): string {
  const d = new Date(ym + '-01T00:00:00');
  return new Intl.DateTimeFormat('ms-MY', { month: 'short' }).format(d);
}

export function hariBerbaki(days: number | null): string {
  if (days === null) return '–';
  if (days <= 0) return 'Habis';
  if (days < 1) return '< 1 hari';
  if (days > 365) return '> 1 tahun';
  return `~${angka(Math.round(days))} hari`;
}
