import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { useApi } from '../api';
import { angka, SOURCE_LABEL } from '../format';
import { Badge, inputCls, Modal } from '../ui';
import type { ItemWithStock } from '../../shared/types';

/** Pemilih item berasaskan modal - selesa digunakan pada telefon (sasaran sentuh besar) */
export function ItemPicker({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: ItemWithStock) => void;
}) {
  const { data } = useApi<{ items: ItemWithStock[] }>('/api/items');
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    let list = data?.items ?? [];
    const ql = q.trim().toLowerCase();
    if (ql) list = list.filter((i) => i.name.toLowerCase().includes(ql) || i.id.toLowerCase().includes(ql) || i.category.toLowerCase().includes(ql));
    return list;
  }, [data, q]);

  return (
    <Modal open={open} onClose={onClose} title="Pilih Item">
      <div className="relative mb-3">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-700/40" />
        <input className={`${inputCls} !pl-10`} aria-label="Cari item" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-cream-200">
        {items.length === 0 && <p className="py-6 text-center text-sm text-bark-700/50">Tiada item dijumpai.</p>}
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => {
              onPick(it);
              onClose();
            }}
            className="flex w-full items-center gap-3 border-b border-cream-100 px-4 py-3 text-left last:border-0 hover:bg-cream-100/70"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-bark-900">{it.name}</div>
              <div className="text-xs text-bark-700/60">
                {SOURCE_LABEL[it.source]}
                {it.category ? ` · ${it.category}` : ''} · {angka(it.stock)} {it.unit} ada
              </div>
            </div>
            <ChevronRight size={16} className="text-bark-700/30" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Butang yang membuka ItemPicker; menunjukkan item terpilih */
export function ItemPickerField({ label, item, onPick }: {
  label: string;
  item: ItemWithStock | null;
  onPick: (i: ItemWithStock) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-bark-800">{label}</span>
      <button
        onClick={() => setOpen(true)}
        className={`${inputCls} flex items-center justify-between text-left`}
      >
        <span className={item ? '' : 'text-bark-700/40'}>
          {item ? item.name : 'Pilih item'}
        </span>
        {item && <Badge className={item.source === 'franchisor' ? 'bg-bark-800 text-cream-100' : 'bg-caramel-400/30 text-coffee-500'}>{SOURCE_LABEL[item.source]}</Badge>}
      </button>
      <ItemPicker open={open} onClose={() => setOpen(false)} onPick={onPick} />
    </div>
  );
}
