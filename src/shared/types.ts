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
  unit_cost: number;
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

export interface TopUsageRow {
  item_id: string;
  name: string;
  unit: string;
  source: Source;
  qty: number;
  cost: number;
}

export interface StaffUsageTotal {
  /** Nama pengguna; null = rekod lama tanpa pengguna */
  user_name: string | null;
  count: number;
  qty: number;
  cost: number;
}

export interface AdjustmentRow {
  id: string;
  date: string;
  reason: string;
  delta: number;
  item_name: string;
  unit: string;
  /** Nilai pelarasan (delta × kos seunit) - boleh negatif */
  value: number;
}

export interface CategoryRow {
  category: string;
  spend: number;
  usage_cost: number;
}

export interface Reports {
  months: MonthRow[];
  top_usage: TopUsageRow[];
  items: ItemWithStock[];
  /** Agregat pengeluaran mengikut pengguna (30 hari) */
  staff_usage: StaffUsageTotal[];
  /** Senarai pelarasan dalam tempat dipilih */
  adjustments: AdjustmentRow[];
  /** Belanja & kos penggunaan mengikut kategori */
  by_category: CategoryRow[];
}

export interface ItemDetail {
  item: ItemWithStock;
  purchases: Purchase[];
  usages: Usage[];
  adjustments: Adjustment[];
}

// ------------------------------------------------------------------ pengguna & kebenaran

export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  full_name: string;
  username: string;
  position: string;
  role: Role;
  created_at: string;
  archived: 0 | 1;
}

export interface AuthMe {
  user: Pick<User, 'id' | 'full_name' | 'username' | 'position' | 'role'> | null;
  needs_setup: boolean;
}

/** Item ringkas tanpa maklumat kos - untuk peranan staff */
export interface StaffItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  source: Source;
  min_qty: number;
  stock: number;
  status: StockStatus;
}

export interface StaffUsageRow {
  id: string;
  item_id: string;
  item_name: string;
  unit: string;
  qty: number;
  date: string;
  created_at: string;
}

/** Data dashboard staff - tiada kos/perbelanjaan langsung */
export interface StaffHome {
  total_items: number;
  need_reorder: StaffItem[];
  my_usage_today: StaffUsageRow[];
}
