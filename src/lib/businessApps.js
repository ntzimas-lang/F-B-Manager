// Οι εφαρμογές του My Business. Για να προστεθεί σύνδεσμος, βάλε url: 'https://…'
// internal: true → ανοίγει μέσα στο F&B Manager
export const BUSINESS_APPS = [
  { id: 'fb', icon: '🍽️', title: 'F&B Manager', desc: 'Απόθεμα, παραλαβές, συνταγές, κόστος, βάρδιες', to: '/dashboard' },
  { id: 'apografi', icon: '📋', title: 'Απογραφή', desc: 'Μηνιαία απογραφή καταστημάτων με barcode', url: 'https://apografi-katastimata.netlify.app' },
  { id: 'deltia', icon: '🧾', title: 'Δελτία Εκδηλώσεων', desc: 'Δελτία αποστολής: κατάστημα, πελάτης, λογιστήριο', url: 'https://claude.ai/artifact/HpBa7RUEhAJarJnei58mLb', external: true },
  { id: 'menu-fc', icon: '📊', title: 'Μηνιαίο Μενού FC', desc: 'Food cost μενού ανά κατάστημα, PowerPoint', url: 'https://claude.ai/artifact/2XU1PWnz1VNn4KMU4cAMS2', external: true },
]
