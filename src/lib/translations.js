export const translations = {
  el: {
    // Πλοήγηση
    dashboard: 'Πίνακας Ελέγχου', stores: 'Καταστήματα', recipes: 'Μενού & Συνταγές', ingredients: 'Πρώτες Ύλες',
    costing: 'Food Costing', inventory: 'Απόθεμα', sales: 'Πωλήσεις', stocktake: 'Απογραφή', orders: 'Παραγγελίες',
    staff: 'Προσωπικό & Βάρδιες', activity: 'Δραστηριότητα', users: 'Χρήστες', logout: 'Αποσύνδεση',
    // Κοινά
    save: 'Αποθήκευση', cancel: 'Ακύρωση', delete: 'Διαγραφή', edit: 'Επεξεργασία', add: 'Προσθήκη',
    name: 'Όνομα', email: 'Email', password: 'Κωδικός', loading: 'Φόρτωση...', confirmDelete: 'Διαγραφή;',
    all: 'Όλα', allStores: 'Όλα τα καταστήματα', role: 'Ρόλος', store: 'Κατάστημα', selectOption: 'Επιλογή...',
    date: 'Ημερομηνία', quantity: 'Ποσότητα', price: 'Τιμή', unit: 'Μονάδα', category: 'Κατηγορία', notes: 'Σημειώσεις',
    // Login
    login: 'Σύνδεση', wrongCredentials: 'Λάθος email ή κωδικός.',
    // Dashboard
    totalStores: 'Καταστήματα', totalRecipes: 'Πιάτα Μενού', totalIngredients: 'Πρώτες Ύλες', totalSuppliers: 'Προμηθευτές',
    totalEmployees: 'Υπάλληλοι', avgFoodCost: 'Μέσο Food Cost %', inventoryValue: 'Αξία Αποθέματος',
    lowStock: 'Χαμηλό Απόθεμα', pendingOrders: 'Εκκρεμείς Παραγγελίες', exportPdf: 'Εξαγωγή σε PDF',
    topFoodCost: 'Πιάτα με Υψηλότερο Food Cost %', recentActivity: 'Πρόσφατη Δραστηριότητα Αποθέματος',
    storeSummary: 'Σύνοψη ανά Κατάστημα', upcomingOrders: 'Επερχόμενες Παραγγελίες',
    // Stores
    newStore: 'Νέο Κατάστημα', code: 'Κωδικός', address: 'Διεύθυνση', noStores: 'Δεν υπάρχουν καταστήματα ακόμα.',
    // Recipes / Ingredients
    dishes: 'Πιάτα', newDish: 'Νέο Πιάτο', sellingPrice: 'Τιμή Πώλησης', portionSize: 'Μερίδα',
    noDishes: 'Δεν υπάρχουν πιάτα ακόμα.', newIngredient: 'Νέα Πρώτη Ύλη', supplier: 'Προμηθευτής',
    noIngredients: 'Δεν υπάρχουν πρώτες ύλες ακόμα.', minStockAlert: 'Όριο Ειδοποίησης Αποθέματος',
    composition: 'Σύνθεση', cost: 'Κόστος', foodCostPct: 'Food Cost %',
    // Inventory
    newMovement: 'Νέα Κίνηση', movementType: 'Τύπος Κίνησης', receipt: 'Παραλαβή', waste: 'Φύρα',
    consumption: 'Ανάλωση', adjustment: 'Διόρθωση', noStock: 'Δεν υπάρχει απόθεμα ακόμα.',
    // Sales
    portionsSold: 'Μερίδες που πουλήθηκαν', portions: 'Μερίδες', revenue: 'Έσοδα', totalRevenue: 'Σύνολο Εσόδων Ημέρας',
    recordSales: 'Καταχώρηση Πωλήσεων', updateSales: 'Ενημέρωση Πωλήσεων', recentDays: 'Πρόσφατες Ημέρες',
    noActiveDishes: 'Δεν υπάρχουν ενεργά πιάτα στο μενού ακόμα.', addStoreFirst: 'Πρόσθεσε πρώτα ένα κατάστημα.',
    // Stocktake
    systemQty: 'Σύστημα', realQty: 'Πραγματική Ποσότητα', variance: 'Διαφορά', recordStocktake: 'Καταχώρηση Απογραφής',
    stocktakeHistory: 'Ιστορικό Απογραφών', noVariance: 'Χωρίς διαφορές',
    // Orders
    newSupplier: 'Νέος Προμηθευτής', newOrder: 'Νέα Παραγγελία', status: 'Κατάσταση', draft: 'Πρόχειρη',
    sent: 'Απεστάλη', received: 'Παραλήφθηκε', cancelled: 'Ακυρώθηκε', noOrders: 'Δεν υπάρχουν παραγγελίες.',
    // Staff
    employees: 'Προσωπικό', shifts: 'Πρόγραμμα Βαρδιών', payroll: 'Μισθοδοσία', newEmployee: 'Νέος Υπάλληλος',
    hourlyRate: 'Ωρομίσθιο', shift: 'Βάρδια', leave: 'Άδεια', dayoff: 'Ρεπό', hours: 'Ώρες',
    noEmployees: 'Δεν υπάρχουν υπάλληλοι ακόμα.',
    // Activity / Users
    user: 'Χρήστης', action: 'Ενέργεια', type: 'Τύπος', item: 'Στοιχείο', created: 'Δημιουργία',
    updated: 'Ενημέρωση', deleted: 'Διαγραφή', noActivity: 'Δεν υπάρχει ακόμα δραστηριότητα.',
    superUser: 'Super User', storeManager: 'Υπεύθυνος Καταστήματος', shiftManager: 'Υπεύθυνος Βάρδιας', accounting: 'Λογιστήριο',
  },
  en: {
    dashboard: 'Dashboard', stores: 'Stores', recipes: 'Menu & Recipes', ingredients: 'Ingredients',
    costing: 'Food Costing', inventory: 'Inventory', sales: 'Sales', stocktake: 'Stocktake', orders: 'Orders',
    staff: 'Staff & Shifts', activity: 'Activity', users: 'Users', logout: 'Log Out',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
    name: 'Name', email: 'Email', password: 'Password', loading: 'Loading...', confirmDelete: 'Delete?',
    all: 'All', allStores: 'All stores', role: 'Role', store: 'Store', selectOption: 'Select...',
    date: 'Date', quantity: 'Quantity', price: 'Price', unit: 'Unit', category: 'Category', notes: 'Notes',
    login: 'Log In', wrongCredentials: 'Wrong email or password.',
    totalStores: 'Stores', totalRecipes: 'Menu Dishes', totalIngredients: 'Ingredients', totalSuppliers: 'Suppliers',
    totalEmployees: 'Staff', avgFoodCost: 'Avg Food Cost %', inventoryValue: 'Inventory Value',
    lowStock: 'Low Stock', pendingOrders: 'Pending Orders', exportPdf: 'Export to PDF',
    topFoodCost: 'Highest Food Cost % Dishes', recentActivity: 'Recent Inventory Activity',
    storeSummary: 'Summary by Store', upcomingOrders: 'Upcoming Orders',
    newStore: 'New Store', code: 'Code', address: 'Address', noStores: 'No stores yet.',
    dishes: 'Dishes', newDish: 'New Dish', sellingPrice: 'Selling Price', portionSize: 'Portion Size',
    noDishes: 'No dishes yet.', newIngredient: 'New Ingredient', supplier: 'Supplier',
    noIngredients: 'No ingredients yet.', minStockAlert: 'Low Stock Alert Threshold',
    composition: 'Composition', cost: 'Cost', foodCostPct: 'Food Cost %',
    newMovement: 'New Movement', movementType: 'Movement Type', receipt: 'Receipt', waste: 'Waste',
    consumption: 'Consumption', adjustment: 'Adjustment', noStock: 'No stock yet.',
    portionsSold: 'Portions Sold', portions: 'portions', revenue: 'Revenue', totalRevenue: "Today's Total Revenue",
    recordSales: 'Record Sales', updateSales: 'Update Sales', recentDays: 'Recent Days',
    noActiveDishes: 'No active menu dishes yet.', addStoreFirst: 'Add a store first.',
    systemQty: 'System', realQty: 'Actual Quantity', variance: 'Variance', recordStocktake: 'Record Stocktake',
    stocktakeHistory: 'Stocktake History', noVariance: 'No variance',
    newSupplier: 'New Supplier', newOrder: 'New Order', status: 'Status', draft: 'Draft',
    sent: 'Sent', received: 'Received', cancelled: 'Cancelled', noOrders: 'No orders yet.',
    employees: 'Staff', shifts: 'Shift Schedule', payroll: 'Payroll', newEmployee: 'New Employee',
    hourlyRate: 'Hourly Rate', shift: 'Shift', leave: 'Leave', dayoff: 'Day Off', hours: 'Hours',
    noEmployees: 'No staff yet.',
    user: 'User', action: 'Action', type: 'Type', item: 'Item', created: 'Created',
    updated: 'Updated', deleted: 'Deleted', noActivity: 'No activity yet.',
    superUser: 'Super User', storeManager: 'Store Manager', shiftManager: 'Shift Manager', accounting: 'Accounting',
  },
}
