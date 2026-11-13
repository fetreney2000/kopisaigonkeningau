import { Layers, Printer } from 'lucide-react';
import QRCodeImg from './QRCodeImg';
import { Button, ErrorState, Spinner } from '../ui';
import { navigate } from '../App';
import { useApi } from '../api';
import type { ItemDetail } from '../../shared/types';

/** Halaman label kod QR untuk dicetak — dibuka dalam tab baharu (#/label/:id) */
export default function Labels({ itemId }: { itemId: string }) {
  const { data, loading, error, reload } = useApi<ItemDetail>(`/api/items/${itemId}`);
  const item = data?.item;

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-2.5">
        <Button className="no-print" onClick={() => window.print()} disabled={!item}>
          <Printer size={17} /> Cetak Label
        </Button>
        <Button variant="secondary" className="no-print" onClick={() => navigate('/label')}>
          <Layers size={17} /> Cetak Pukal
        </Button>
      </div>

      <div className="print-area">
        {loading && <Spinner />}
        {error && <ErrorState message={error} reload={reload} />}
        {item && (
          <div className="mx-auto flex w-fit flex-col items-center gap-3 rounded-2xl border-4 border-bark-900 bg-white px-10 py-8">
            <QRCodeImg value={item.id} size={200} />
            <div className="max-w-72 text-center">
              <div className="text-2xl font-extrabold leading-snug text-bark-900">{item.name}</div>
              <div className="num mt-1 font-mono text-base font-bold tracking-wider text-coffee-500">{item.id}</div>
              <div className="mt-1.5 text-sm text-bark-700/70">
                Imbas untuk merekod stok{item.unit ? ` · ${item.unit}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-bark-700/60 no-print">
        Petua: cetak label ini, tampal pada bekas atau rak item, dan pastikan terdapat ruang kosong
        di sekeliling kod QR supaya mudah diimbas. Kod QR ini kekal sah selagi item belum dipadam.
      </p>
    </div>
  );
}
