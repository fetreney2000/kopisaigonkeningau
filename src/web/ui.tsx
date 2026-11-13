import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

// ------------------------------------------------------------------ Butang

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, className = '', full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  full?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold min-h-11 px-4 transition-colors select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coffee-500';
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-bark-800 text-cream-50 hover:bg-bark-700 active:bg-bark-900',
    secondary: 'bg-white text-bark-800 border border-cream-300 hover:bg-cream-100 active:bg-cream-200',
    ghost: 'bg-transparent text-bark-700 hover:bg-cream-200',
    danger: 'bg-berry-soft text-berry-600 hover:bg-berry-600 hover:text-white',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${full ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Kod / lencana

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

export function SourceBadge({ source }: { source: 'franchisor' | 'local' }) {
  return source === 'franchisor' ? (
    <Badge className="bg-bark-800 text-cream-100">Francais</Badge>
  ) : (
    <Badge className="bg-caramel-400/30 text-coffee-500">Tempatan</Badge>
  );
}

// ------------------------------------------------------------------ Kad

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white shadow-[0_1px_3px_rgba(43,33,26,0.08),0_1px_2px_rgba(43,33,26,0.04)] ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-sm font-bold tracking-wide text-bark-700 uppercase">{children}</h2>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ Borang

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-bark-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-bark-700/60">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-cream-300 bg-white px-3.5 py-2.5 text-[15px] text-bark-900 placeholder:text-bark-700/35 focus:border-coffee-500 focus:outline-2 focus:outline-coffee-500/25';

export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl bg-cream-200 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            value === o.value ? 'bg-white text-bark-900 shadow-sm' : 'text-bark-700/60 hover:text-bark-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Modal (satah bawah di telefon)

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-bark-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative flex max-h-[92vh] w-full flex-col bg-white shadow-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
          <h3 className="text-lg font-bold text-bark-900">{title}</h3>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-2 text-bark-700 hover:bg-cream-200">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-safe">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmLabel = 'Sahkan' }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-[15px] text-bark-800">{message}</p>
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" full onClick={onCancel}>Batal</Button>
        <Button variant="danger" full onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Toast

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; msg: string; kind: ToastKind }

let pushToast: ((msg: string, kind?: ToastKind) => void) | null = null;

export function toast(msg: string, kind: ToastKind = 'success') {
  pushToast?.(msg, kind);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let n = 0;
    pushToast = (msg, kind = 'success') => {
      const id = ++n;
      setItems((arr) => [...arr, { id, msg, kind }]);
      setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), 3200);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 no-print">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-bark-900 px-4 py-3 text-sm font-medium text-cream-50 shadow-lg"
        >
          {t.kind === 'success' ? <Check size={18} className="text-leaf-600" /> : t.kind === 'error' ? <AlertTriangle size={18} className="text-caramel-400" /> : <Info size={18} className="text-caramel-400" />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Lain-lain

export function Spinner({ className = '', small }: { className?: string; small?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${small ? 'py-0' : 'py-12'} ${className}`}>
      <div className={`${small ? 'h-5 w-5 border-2' : 'h-8 w-8 border-[3px]'} animate-spin rounded-full border-cream-300 border-t-coffee-500`} />
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="rounded-full bg-cream-200 p-3 text-coffee-500">{icon}</div>
      <h3 className="mt-1 font-bold text-bark-900">{title}</h3>
      <p className="max-w-xs text-sm text-bark-700/70">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

export function ErrorState({ message, reload }: { message: string; reload?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="rounded-full bg-berry-soft p-3 text-berry-600"><AlertTriangle size={22} /></div>
      <h3 className="font-bold text-bark-900">Sesuatu tidak kena</h3>
      <p className="max-w-sm text-sm text-bark-700/70">{message}</p>
      {reload && (
        <Button variant="secondary" className="mt-3" onClick={reload}>Cuba Semula</Button>
      )}
    </Card>
  );
}
