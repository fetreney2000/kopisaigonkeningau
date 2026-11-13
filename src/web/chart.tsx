import { bulanPendek, rmPlain } from './format';
import type { MonthRow } from '../shared/types';

/** Carta bar berkumpulan bulanan: belanja per sumber. SVG tulen, tiada pustaka. */
export function SpendChart({ months, mode }: { months: MonthRow[]; mode: 'spend' | 'usage' }) {
  const key = mode === 'spend' ? ('spend_franchisor' as const) : ('usage_franchisor' as const);
  const keyL = mode === 'spend' ? ('spend_local' as const) : ('usage_local' as const);
  const max = Math.max(1, ...months.map((m) => m[key] + m[keyL]));
  const H = 140;
  const gap = 8;

  if (months.every((m) => m[key] + m[keyL] === 0)) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-bark-700/50">
        Tiada data untuk julat masa ini
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-[max(gap,4px)]">
        {months.map((m) => {
          const hF = (m[key] / max) * (H - 20);
          const hL = (m[keyL] / max) * (H - 20);
          return (
            <div key={m.ym} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-col justify-end" style={{ height: H - 24 }}>
                {m[keyL] > 0 && (
                  <div
                    title={`${bulanPendek(m.ym)} — Tempatan: ${rmPlain(m[keyL])}`}
                    className="w-full rounded-t-md bg-caramel-400 transition-all"
                    style={{ height: Math.max(hL, m[keyL] > 0 ? 3 : 0) }}
                  />
                )}
                {m[key] > 0 && (
                  <div
                    title={`${bulanPendek(m.ym)} — Francais: ${rmPlain(m[key])}`}
                    className={`w-full bg-bark-800 transition-all ${m[keyL] > 0 ? '' : 'rounded-t-md'}`}
                    style={{ height: Math.max(hF, m[key] > 0 ? 3 : 0) }}
                  />
                )}
              </div>
              <span className="text-[11px] font-medium text-bark-700/70">{bulanPendek(m.ym)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-cream-200 pt-3 text-xs text-bark-700">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-bark-800" /> Francais</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-caramel-400" /> Tempatan</span>
      </div>
    </div>
  );
}

/** Bar mendatar untuk pecahan sumber */
export function SourceBar({ franchisor, local }: { franchisor: number; local: number }) {
  const total = franchisor + local;
  if (total <= 0) return <div className="h-2.5 w-full rounded-full bg-cream-200" />;
  const pF = (franchisor / total) * 100;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-cream-200">
      <div className="bg-bark-800" style={{ width: `${pF}%` }} />
      <div className="bg-caramel-400" style={{ width: `${100 - pF}%` }} />
    </div>
  );
}
