-- ============================================
-- F&B MANAGER - Supabase Schema
-- ============================================

-- Καταστήματα
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  address text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Προμηθευτές
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Πρώτες ύλες
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null, -- kg, lt, τεμ, gr, ml
  current_price numeric(10,4) not null default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  category text,
  min_stock_alert numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- Συνταγές / Πιάτα Μενού
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text, -- πρώτο πιάτο, κυρίως, γλυκό, ποτό κλπ
  selling_price numeric(10,2) not null default 0,
  portion_size text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Σύνδεση συνταγής - πρώτων υλών (recipe cost breakdown)
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  quantity numeric(10,4) not null, -- ποσότητα στη μονάδα του ingredient
  created_at timestamptz default now()
);

-- Απόθεμα ανά κατάστημα
create table if not exists inventory_stock (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  quantity numeric(10,2) not null default 0,
  updated_at timestamptz default now(),
  unique(store_id, ingredient_id)
);

-- Κινήσεις αποθέματος
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  movement_type text not null check (movement_type in ('receipt','waste','consumption','adjustment')),
  quantity numeric(10,2) not null, -- θετικό για receipt, αρνητικό για waste/consumption
  note text,
  created_at timestamptz default now()
);

-- Παραγγελίες προμηθευτών
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete cascade,
  status text default 'draft' check (status in ('draft','sent','received','cancelled')),
  order_date date default current_date,
  expected_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references purchase_orders(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  quantity numeric(10,2) not null,
  unit_price numeric(10,4) not null,
  received_quantity numeric(10,2) default 0
);

-- Υπάλληλοι
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  store_id uuid references stores(id) on delete set null,
  hourly_rate numeric(10,2) not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Βάρδιες / Άδειες / Ρεπό
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  store_id uuid references stores(id) on delete cascade,
  date date not null,
  type text not null default 'shift' check (type in ('shift','leave','dayoff')),
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz default now()
);

-- Μηνιαία Απογραφή
create table if not exists stocktakes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  date date default current_date,
  notes text,
  created_at timestamptz default now(),
  unique(store_id, month)
);

create table if not exists stocktake_items (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid references stocktakes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  system_qty numeric(10,2) not null default 0,
  counted_qty numeric(10,2) not null default 0,
  variance numeric(10,2) not null default 0
);

-- Indexes
create index if not exists idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index if not exists idx_inventory_store on inventory_stock(store_id);
create index if not exists idx_movements_store on stock_movements(store_id);
create index if not exists idx_po_store on purchase_orders(store_id);
create index if not exists idx_employees_store on employees(store_id);
create index if not exists idx_shifts_employee on shifts(employee_id);
create index if not exists idx_shifts_date on shifts(date);
create index if not exists idx_stocktakes_store on stocktakes(store_id);
create index if not exists idx_stocktake_items_stocktake on stocktake_items(stocktake_id);

-- Enable RLS (πολιτικές ανοιχτές για demo - προσάρμοσε ανά χρήση)
alter table stores enable row level security;
alter table suppliers enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table inventory_stock enable row level security;
alter table stock_movements enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table employees enable row level security;
alter table shifts enable row level security;
alter table stocktakes enable row level security;
alter table stocktake_items enable row level security;

create policy "allow_all_stores" on stores for all using (true) with check (true);
create policy "allow_all_suppliers" on suppliers for all using (true) with check (true);
create policy "allow_all_ingredients" on ingredients for all using (true) with check (true);
create policy "allow_all_recipes" on recipes for all using (true) with check (true);
create policy "allow_all_recipe_ingredients" on recipe_ingredients for all using (true) with check (true);
create policy "allow_all_inventory" on inventory_stock for all using (true) with check (true);
create policy "allow_all_movements" on stock_movements for all using (true) with check (true);
create policy "allow_all_po" on purchase_orders for all using (true) with check (true);
create policy "allow_all_po_items" on purchase_order_items for all using (true) with check (true);
create policy "allow_all_employees" on employees for all using (true) with check (true);
create policy "allow_all_shifts" on shifts for all using (true) with check (true);
create policy "allow_all_stocktakes" on stocktakes for all using (true) with check (true);
create policy "allow_all_stocktake_items" on stocktake_items for all using (true) with check (true);
