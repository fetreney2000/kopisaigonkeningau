import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const DARK = '#2f2217';
const LIGHT = '#ffffff';

/** Komponen kod QR — nilai = kod item, output PNG data-URL */
export default function QRCodeImg({ value, size = 96, margin = 2, className = '' }: { value: string; size?: number; margin?: number; className?: string }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      margin,
      width: size * 4,
      errorCorrectionLevel: 'M',
      color: { dark: DARK, light: LIGHT },
    }).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [value, size, margin]);
  return <img src={url} width={size} height={size} alt={`Kod QR ${value}`} className={className} />;
}

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
  const qrUrl = await QRCode.toDataURL(value, {
    margin: 3,
    width: 640,
    errorCorrectionLevel: 'M',
    color: { dark: DARK, light: LIGHT },
  });
  if (!label) return qrUrl;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Gagal memuatkan imej QR'));
    img.src = qrUrl;
  });

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
      // Kod item kecil di bawah nama
      ctx.font = 'bold 30px ui-monospace, monospace';
      ctx.fillStyle = '#6e4b2a';
      ctx.fillText(value, canvas.width / 2, startY + lines.length * (fs + 10) + 8);
      return canvas.toDataURL('image/png');
    }
  }
  return qrUrl;
}
