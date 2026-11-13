// Jenis data yang dikongsi antara pelayan (Worker) dan klien (React)

export type Source = 'franchisor' | 'local';
export type StockStatus = 'habis' | 'rendah' | 'hampir' | 'ok';
export type MovementKind = 'purchase' | 'usage' | 'adjustment';

export interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  source: Source;
  unit_cost: number;
  min_qty: number;
  note: string;
  created_at: string;
}

export interface ItemWithStock extends Item {
  stock: number;
  status: StockStatus;
  /** Purata penggunaan harian (30 hari lalu) */
  daily_rate: number;
  /** Anggaran hari sehingga habis, atau null jika tiada kadar penggunaan */
  days_left: number | null;
  /** Unjuran kos penggunaan sebulan (30 hari) */
  projected_monthly_cost: number;
}

export interface Purchase {
  id: string;
  item_id: string;
  qty: number;
  unit_cost: number;
  date: string;
  note: string;
  created_at: string;
  item_name?: string;
  item_unit?: string;
  item_source?: Source;
}

export interface Usage {
  id: string;
  item_id: string;
  qty: number;
  date: string;
  method: 'scan' | 'manual';
  note: string;
  created_at: string;
  item_name?: string;
  item_unit?: string;
  item_source?: Source;
}

export interface Adjustment {
  id: string;
  item_id: string;
  delta: number;
  date: string;
  reason: string;
  created_at: string;
  item_name?: string;
  item_unit?: string;
  item_source?: Source;
}

export interface Movement {
  kind: MovementKind;
  id: string;
  item_id: string;
  item_name: string;
  item_unit: string;
  item_source: Source;
  qty: number;
  unit_cost: number | null;
  date: string;
  note: string;
  created_at: string;
}

export interface SourceTotals {
  franchisor: number;
  local: number;
}

export interface Summary {
  stock_value: number;
  stock_value_by_source: SourceTotals;
  active_items: number;
  spend_month: SourceTotals;
  usage_cost_30d: SourceTotals;
  projection_30d: SourceTotals;
  low_stock: ItemWithStock[];
  out_count: number;
  low_count: number;
  recent: Movement[];
}

export interface MonthRow {
  ym: string;
  spend_franchisor: number;
  spend_local: number;
  usage_franchisor: number;
  usage_local: number;
}

export interface Reports {
  months: MonthRow[];
  top_usage: { item_id: string; name: string; unit: string; source: Source; qty: number; cost: number }[];
  items: ItemWithStock[];
}

export interface ItemDetail {
  item: ItemWithStock;
  purchases: Purchase[];
  usages: Usage[];
  adjustments: Adjustment[];
}
