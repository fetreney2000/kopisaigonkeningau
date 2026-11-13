import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const DARK = '#2f2217';
const LIGHT = '#ffffff';
const LOGO_URL = '/logo.svg';

// ------------------------------------------------------------------ pembantu imej

function imgOf(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuatkan imej: ${src}`));
    img.src = src;
  });
}

let logoPromise: Promise<HTMLImageElement> | null = null;

/** Muat logo jenama sekali sahaja untuk semua QR */
function loadLogo(): Promise<HTMLImageElement> {
  logoPromise ??= imgOf(LOGO_URL);
  return logoPromise;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------------ jana QR berlogo

const composeCache = new Map<string, string>();

/**
 * Jana PNG kod QR dengan logo jenama di tengah (arus lambang disimpan).
 * Tahap pembetulan ralat 'H' (30%) membolehkan logo menutup ~25% tengah QR
 * tanpa merosakkan kebolehimbasan. Keputusan di-cache ikut nilai+saiz.
 */
export async function getQrDataUrl(value: string, size: number, margin = 2): Promise<string> {
  const key = `${value}|${size}|${margin}`;
  const cached = composeCache.get(key);
  if (cached) return cached;

  const width = size * 4;
  const raw = await QRCode.toDataURL(value, {
    margin,
    width,
    errorCorrectionLevel: 'H',
    color: { dark: DARK, light: LIGHT },
  });

  let url = raw;
  try {
    const [logo, qr] = await Promise.all([loadLogo(), imgOf(raw)]);
    const canvas = document.createElement('canvas');
    canvas.width = qr.width;
    canvas.height = qr.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(qr, 0, 0);

      // Kotak putih sudut bulat di tengah, logo coklat di dalamnya
      const box = Math.round(qr.width * 0.26);
      const bx = Math.round((qr.width - box) / 2);
      ctx.fillStyle = LIGHT;
      roundRectPath(ctx, bx, bx, box, box, Math.round(box * 0.18));
      ctx.fill();

      const pad = Math.round(box * 0.14);
      const avail = box - pad * 2;
      const scale = Math.min(avail / logo.width, avail / logo.height);
      const lw = logo.width * scale;
      const lh = logo.height * scale;
      ctx.drawImage(logo, bx + (box - lw) / 2, bx + (box - lh) / 2, lw, lh);

      url = canvas.toDataURL('image/png');
    }
  } catch {
    // Logo gagal dimuat — QR asas tanpa logo masih sah
  }

  composeCache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ komponen

/** Komponen kod QR — nilai = kod item/pengguna, output PNG data-URL dengan logo tengah */
export default function QRCodeImg({ value, size = 96, margin = 2, className = '' }: { value: string; size?: number; margin?: number; className?: string }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    let alive = true;
    void getQrDataUrl(value, size, margin).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [value, size, margin]);
  return <img src={url} width={size} height={size} alt={`Kod QR ${value}`} className={className} />;
}

// ------------------------------------------------------------------ muat turun PNG berlabel

/** Lilit teks kepada barisan yang muat dengan lebar tertentu */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Jana PNG kod QR lengkap dengan nama item di bawah — untuk muat turun
 * dan label supaya item mudah dikenali tanpa perlu mengimbas.
 */
export async function qrPngDataUrl(value: string, label?: string): Promise<string> {
  const qrUrl = await getQrDataUrl(value, 160, 3);
  if (!label) return qrUrl;

  const img = await imgOf(qrUrl);

  const pad = 56;
  const textBlock = 140;
  const canvas = document.createElement('canvas');
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2 + textBlock;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrUrl;

  ctx.fillStyle = LIGHT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, pad, pad);

  ctx.fillStyle = DARK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const fontSizes = [56, 48, 42, 36];
  for (const fs of fontSizes) {
    ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
    const lines = wrapText(ctx, label, canvas.width - pad * 2);
    if (lines.length <= 2) {
      const startY = img.height + pad * 2 + 18;
      lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, startY + i * (fs + 10)));
      // Kod item kecil di bawah nama (PNG muat turun sahaja)
      ctx.font = 'bold 30px ui-monospace, monospace';
      ctx.fillStyle = '#6e4b2a';
      ctx.fillText(value, canvas.width / 2, startY + lines.length * (fs + 10) + 8);
      return canvas.toDataURL('image/png');
    }
  }
  return qrUrl;
}
