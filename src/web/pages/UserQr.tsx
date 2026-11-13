import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import QRCodeImg from './QRCodeImg';
import { Button, Modal } from '../ui';
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

/** Modal paparan kod QR baharu (dipakai oleh halaman Pengguna dan modal Akaun) */
export function QrLoginModal({ data, onClose, onRotate }: { data: UserQrData | null; onClose: () => void; onRotate?: () => void }) {
  return (
    <Modal open={!!data} onClose={onClose} title="Kod QR Log Masuk">
      {data && (
        <div className="space-y-4 text-center">
          <div className="mx-auto w-fit rounded-2xl border-4 border-bark-900 bg-white px-8 py-6">
            <QRCodeImg value={data.code} size={180} />
            <div className="mt-3 text-lg font-extrabold text-bark-900">{data.name}</div>
            <div className="num mt-1 font-mono text-[10px] tracking-wider text-bark-700/40">{data.code}</div>
          </div>
          <p className="text-sm text-bark-700/70">
            Kod ini ialah <b>kunci log masuk</b>. Cetak dan simpan dengan selamat. Sesiapa yang memegangnya boleh log masuk
            sebagai pengguna ini. Kod disimpan tersulit, jadi kad ini boleh dilihat semula bila-bila masa.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" full onClick={onClose}>Selesai</Button>
            <Button full onClick={() => { setUserQrData(data); onClose(); navigate('/cetak-qr-pengguna'); }}>
              <Printer size={17} /> Cetak QR
            </Button>
          </div>
          {onRotate && (
            <button onClick={onRotate} className="mx-auto block text-xs font-semibold text-bark-700/60 underline hover:text-bark-900">
              Tukar ke kod QR baharu (kod lama tidak sah)
            </button>
          )}
        </div>
      )}
    </Modal>
  );
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
            <div className="mt-1.5 text-sm text-bark-700/70">
              Imbas untuk log masuk{data.position ? ` · ${data.position}` : ''}
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-bark-700/60 no-print">
        Petua: cetak dan tampal pada kad pekerja atau simpan di kaunter. Sesuai yang tidak berdaftar log masuk dengan kata laluan.
        Jika kad hilang, admin boleh <b>Tukar Kod QR</b> dan kod lama terus tidak sah.
      </p>
    </div>
  );
}
