export const PLAN_FEATURES = {
  basic: ['dashboard', 'stores', 'ingredients', 'inventory', 'receiving', 'stocktake', 'users'],
  pro: ['dashboard', 'stores', 'ingredients', 'inventory', 'receiving', 'stocktake', 'users', 'orders', 'recipes', 'costing', 'sales', 'reports'],
  premium: ['dashboard', 'stores', 'ingredients', 'inventory', 'receiving', 'stocktake', 'users', 'orders', 'recipes', 'costing', 'sales', 'reports', 'staff', 'activity'],
}
export const PLANS = ['basic', 'pro', 'premium']
export const TOGGLEABLE = ['ingredients', 'inventory', 'receiving', 'stocktake', 'orders', 'recipes', 'costing', 'sales', 'reports', 'staff', 'activity']

// Ενότητες που επιτρέπονται ανά ρόλο (εκτός από το πακέτο του πελάτη)
export const ROLE_MODULES = {
  super_user: null, // όλα
  owner: null,
  store_manager: ['dashboard', 'stores', 'ingredients', 'inventory', 'receiving', 'stocktake', 'orders', 'recipes', 'costing', 'sales', 'reports', 'staff'],
  shift_manager: ['dashboard', 'ingredients', 'inventory', 'receiving', 'stocktake', 'orders', 'recipes', 'sales', 'staff'],
  accounting: ['dashboard', 'ingredients', 'inventory', 'receiving', 'stocktake', 'orders', 'recipes', 'costing', 'sales', 'reports', 'staff'],
}
