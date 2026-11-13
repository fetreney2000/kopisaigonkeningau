import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import QRCodeImg from './QRCodeImg';
import { Button } from '../ui';
import { navigate } from '../App';

/** Data kod QR pengguna dihantar melalui sessionStorage (dipaparkan sekali sahaja oleh admin) */
export interface UserQrData {
  name: string;
  username: string;
  position?: string;
  code: string;
}

export function setUserQrData(d: UserQrData) {
  sessionStorage.setItem('userQr', JSON.stringify(d));
}

export function takeUserQrData(): UserQrData | null {
  const raw = sessionStorage.getItem('userQr');
  if (!raw) return null;
  sessionStorage.removeItem('userQr');
  try {
    return JSON.parse(raw) as UserQrData;
  } catch {
    return null;
  }
}

/** Halaman cetak kod QR log masuk pengguna (#/cetak-qr-pengguna) */
export default function UserQr() {
  const data = takeUserQrData();

  useEffect(() => {
    if (!data) navigate('/pengguna');
  }, [data]);

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-2.5 no-print">
        <Button onClick={() => window.print()}>
          <Printer size={17} /> Cetak Kod QR Log Masuk
        </Button>
        <Button variant="secondary" onClick={() => navigate('/pengguna')}>
          Kembali
        </Button>
      </div>

      <div className="print-area">
        <div className="mx-auto flex w-fit flex-col items-center gap-3 rounded-2xl border-4 border-bark-900 bg-white px-10 py-8">
          <QRCodeImg value={data.code} size={200} />
          <div className="max-w-72 text-center">
            <div className="text-2xl font-extrabold leading-snug text-bark-900">{data.name}</div>
            <div className="num mt-1 font-mono text-base font-bold tracking-wider text-coffee-500">{data.code}</div>
            <div className="mt-1.5 text-sm text-bark-700/70">
              Imbas untuk log masuk{data.position ? ` · ${data.position}` : ''}
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-bark-700/60 no-print">
        Petua: cetak dan tampal pada kad pekerja atau simpan di kaunter. Sesuai yang tidak berdaftar log masuk dengan kata laluan.
        Jika kad hilang, admin boleh <b>Tukar Kod QR</b> — kod lama terus tidak sah.
      </p>
    </div>
  );
}
