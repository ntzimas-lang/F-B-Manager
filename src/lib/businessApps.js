// Οι εφαρμογές του My Business. Για να προστεθεί σύνδεσμος, βάλε url: 'https://…'
// internal: true → ανοίγει μέσα στο F&B Manager
export const BUSINESS_APPS = [
  { id: 'fb', icon: 'UtensilsCrossed', title: 'F&B Manager', desc: 'Απόθεμα, παραλαβές, συνταγές, κόστος, βάρδιες', to: '/dashboard' },
  { id: 'apografi', icon: 'ClipboardList', title: 'Απογραφή', desc: 'Μηνιαία απογραφή καταστημάτων με barcode', url: '/apografi/index.html' },
  { id: 'deltia', icon: 'Receipt', title: 'Δελτία Εκδηλώσεων', desc: 'Δελτία αποστολής: κατάστημα, πελάτης, λογιστήριο', to: '/deltia' },
  { id: 'menu-fc', icon: 'ChartColumn', title: 'Μηνιαίο Μενού FC', desc: 'Food cost μενού ανά κατάστημα, PowerPoint', to: '/menu-fc' },
  { id: 'tameio', icon: 'CalendarDays', title: 'Events', desc: 'Εκδηλώσεις: κλείσιμο ταμείου, μάρκες, εργαζόμενοι', url: '/tameio/index.html' },
  { id: 'pnl', icon: 'Calculator', title: 'Εστιατόριο PNL', desc: 'P&L εστιατορίου με λειτουργικούς δείκτες', url: '/pnl/index.html' },
]
