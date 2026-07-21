import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const OLIVE_RGB = [61, 74, 40] // #3d4a28

export default function Dashboard() {
  const { stores } = useStores()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    recipes: 0, ingredients: 0, suppliers: 0, employees: 0,
    lowStock: 0, pendingOrders: 0, avgCostPct: 0, inventoryValue: 0,
  })
  const [topCost, setTopCost] = useState([])
  const [lowStockList, setLowStockList] = useState([])
  const [recentMovements, setRecentMovements] = useState([])
  const [storeSummary, setStoreSummary] = useState([])
  const [pendingOrdersList, setPendingOrdersList] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [
        { count: recipeCount }, { count: ingCount }, { count: supplierCount }, { count: employeeCount },
        { data: stock }, { data: pendingOrders }, { data: recipes }, { data: links }, { data: ingredients },
        { data: movements }, { data: allStores },
      ] = await Promise.all([
        supabase.from('recipes').select('*', { count: 'exact', head: true }),
        supabase.from('ingredients').select('*', { count: 'exact', head: true }),
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('inventory_stock').select('*, ingredients(name, unit, current_price, min_stock_alert), stores(name)'),
        supabase.from('purchase_orders').select('*, stores(name), suppliers(name)').in('status', ['draft', 'sent']).order('order_date', { ascending: true }),
        supabase.from('recipes').select('*').eq('active', true),
        supabase.from('recipe_ingredients').select('*'),
        supabase.from('ingredients').select('*'),
        supabase.from('stock_movements').select('*, ingredients(name), stores(name)').order('created_at', { ascending: false }).limit(8),
        supabase.from('stores').select('*').eq('active', true),
      ])

      const ingMap = Object.fromEntries((ingredients || []).map((i) => [i.id, i]))
      const costRows = (recipes || []).map((r) => {
        const recLinks = (links || []).filter((l) => l.recipe_id === r.id)
        const cost = recLinks.reduce((sum, l) => sum + (ingMap[l.ingredient_id]?.current_price * l.quantity || 0), 0)
        const costPct = r.selling_price > 0 ? (cost / r.selling_price) * 100 : null
        return { ...r, cost, costPct }
      })
      const validCostPcts = costRows.filter((r) => r.costPct !== null)
      const avgCostPct = validCostPcts.length ? validCostPcts.reduce((a, b) => a + b.costPct, 0) / validCostPcts.length : 0
      const topCostSorted = [...validCostPcts].sort((a, b) => b.costPct - a.costPct).slice(0, 5)

      const lowStock = (stock || []).filter((s) => s.ingredients?.min_stock_alert > 0 && s.quantity <= s.ingredients.min_stock_alert)
      const inventoryValue = (stock || []).reduce((sum, s) => sum + (s.quantity * (s.ingredients?.current_price || 0)), 0)

      const summary = (allStores || []).map((st) => {
        const storeStock = (stock || []).filter((s) => s.store_id === st.id)
        const storeLow = storeStock.filter((s) => s.ingredients?.min_stock_alert > 0 && s.quantity <= s.ingredients.min_stock_alert).length
        const storeValue = storeStock.reduce((sum, s) => sum + (s.quantity * (s.ingredients?.current_price || 0)), 0)
        const storePending = (pendingOrders || []).filter((o) => o.store_id === st.id).length
        return { name: st.name, lowStock: storeLow, value: storeValue, pending: storePending }
      })

      setStats({
        recipes: recipeCount || 0, ingredients: ingCount || 0, suppliers: supplierCount || 0, employees: employeeCount || 0,
        lowStock: lowStock.length, pendingOrders: (pendingOrders || []).length, avgCostPct, inventoryValue,
      })
      setTopCost(topCostSorted)
      setLowStockList(lowStock.slice(0, 8))
      setRecentMovements(movements || [])
      setStoreSummary(summary)
      setPendingOrdersList((pendingOrders || []).slice(0, 6))
      setLoading(false)
    }
    load()
  }, [])

  function exportPDF() {
    const doc = new jsPDF()
    const today = new Date().toLocaleDateString('el-GR')

    doc.setFillColor(...OLIVE_RGB)
    doc.rect(0, 0, 210, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text('F&B Manager — Πίνακας Ελέγχου', 14, 14)
    doc.setFontSize(10)
    doc.text(today, 190, 14, { align: 'right' })

    doc.setTextColor(30, 30, 30)
    let y = 32
    doc.setFontSize(12)
    doc.text('Γενικά Στοιχεία', 14, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Δείκτης', 'Τιμή']],
      body: [
        ['Καταστήματα', String(stores.length)],
        ['Πιάτα Μενού', String(stats.recipes)],
        ['Πρώτες Ύλες', String(stats.ingredients)],
        ['Προμηθευτές', String(stats.suppliers)],
        ['Υπάλληλοι', String(stats.employees)],
        ['Μέσο Food Cost %', `${stats.avgCostPct.toFixed(1)}%`],
        ['Αξία Αποθέματος', `${stats.inventoryValue.toFixed(2)} €`],
        ['Χαμηλό Απόθεμα', String(stats.lowStock)],
        ['Εκκρεμείς Παραγγελίες', String(stats.pendingOrders)],
      ],
      theme: 'striped',
      headStyles: { fillColor: OLIVE_RGB },
      styles: { font: 'helvetica' },
    })
    y = doc.lastAutoTable.finalY + 10

    if (topCost.length > 0) {
      doc.text('Πιάτα με Υψηλότερο Food Cost %', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Πιάτο', 'Κόστος', 'Τιμή', 'Food Cost %']],
        body: topCost.map((r) => [r.name, `${r.cost.toFixed(2)} €`, `${Number(r.selling_price).toFixed(2)} €`, `${r.costPct.toFixed(1)}%`]),
        theme: 'striped',
        headStyles: { fillColor: OLIVE_RGB },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    if (storeSummary.length > 0) {
      if (y > 240) { doc.addPage(); y = 20 }
      doc.text('Σύνοψη ανά Κατάστημα', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Κατάστημα', 'Αξία Αποθέματος', 'Χαμηλό Απόθεμα', 'Εκκρεμείς Παραγγελίες']],
        body: storeSummary.map((s) => [s.name, `${s.value.toFixed(2)} €`, String(s.lowStock), String(s.pending)]),
        theme: 'striped',
        headStyles: { fillColor: OLIVE_RGB },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    if (lowStockList.length > 0) {
      if (y > 240) { doc.addPage(); y = 20 }
      doc.text('Χαμηλό Απόθεμα — Λεπτομέρειες', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Πρώτη Ύλη', 'Κατάστημα', 'Ποσότητα', 'Όριο']],
        body: lowStockList.map((s) => [s.ingredients?.name, s.stores?.name, `${s.quantity} ${s.ingredients?.unit}`, String(s.ingredients?.min_stock_alert)]),
        theme: 'striped',
        headStyles: { fillColor: OLIVE_RGB },
      })
    }

    doc.save(`fb-manager-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Πίνακας Ελέγχου</h1>
        <button className="btn" onClick={exportPDF}><Download size={16} /> Εξαγωγή σε PDF</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="stat-label">Καταστήματα</div><div className="stat-value">{stores.length}</div></div>
        <div className="card"><div className="stat-label">Πιάτα Μενού</div><div className="stat-value">{stats.recipes}</div></div>
        <div className="card"><div className="stat-label">Πρώτες Ύλες</div><div className="stat-value">{stats.ingredients}</div></div>
        <div className="card"><div className="stat-label">Μέσο Food Cost %</div><div className="stat-value">{stats.avgCostPct.toFixed(1)}%</div></div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="stat-label">Προμηθευτές</div><div className="stat-value">{stats.suppliers}</div></div>
        <div className="card"><div className="stat-label">Υπάλληλοι</div><div className="stat-value">{stats.employees}</div></div>
        <div className="card"><div className="stat-label">Αξία Αποθέματος</div><div className="stat-value">{stats.inventoryValue.toFixed(0)} €</div></div>
        <div className="card">
          <div className="stat-label">Χαμηλό Απόθεμα</div>
          <div className="stat-value" style={{ color: stats.lowStock > 0 ? 'var(--danger)' : 'var(--ok)' }}>{stats.lowStock}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Πιάτα με Υψηλότερο Food Cost %</h2>
          {loading ? <p>Φόρτωση...</p> : topCost.length === 0 ? <p>Δεν υπάρχουν αρκετά δεδομένα.</p> : (
            <table>
              <thead><tr><th>Πιάτο</th><th>Food Cost %</th></tr></thead>
              <tbody>
                {topCost.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td style={{ color: r.costPct > 35 ? 'var(--danger)' : r.costPct > 28 ? 'var(--warn)' : 'var(--ok)', fontWeight: 600 }}>{r.costPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Πρόσφατη Δραστηριότητα Αποθέματος</h2>
          {loading ? <p>Φόρτωση...</p> : recentMovements.length === 0 ? <p>Δεν υπάρχει ακόμα δραστηριότητα.</p> : (
            <table>
              <thead><tr><th>Πρώτη Ύλη</th><th>Κατάστημα</th><th>Τύπος</th><th>Ποσότητα</th></tr></thead>
              <tbody>
                {recentMovements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.ingredients?.name}</td><td>{m.stores?.name}</td>
                    <td>{m.movement_type === 'receipt' ? 'Παραλαβή' : m.movement_type === 'waste' ? 'Φύρα' : m.movement_type === 'consumption' ? 'Ανάλωση' : 'Διόρθωση'}</td>
                    <td style={{ color: m.quantity < 0 ? 'var(--danger)' : 'var(--ok)' }}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Σύνοψη ανά Κατάστημα</h2>
        {loading ? <p>Φόρτωση...</p> : storeSummary.length === 0 ? <p>Δεν υπάρχουν καταστήματα ακόμα.</p> : (
          <table>
            <thead><tr><th>Κατάστημα</th><th>Αξία Αποθέματος</th><th>Χαμηλό Απόθεμα</th><th>Εκκρεμείς Παραγγελίες</th></tr></thead>
            <tbody>
              {storeSummary.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td><td>{s.value.toFixed(2)} €</td>
                  <td>{s.lowStock > 0 ? <span className="badge badge-danger">{s.lowStock}</span> : <span className="badge badge-ok">0</span>}</td>
                  <td>{s.pending > 0 ? <span className="badge badge-warn">{s.pending}</span> : <span className="badge badge-ok">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingOrdersList.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Επερχόμενες Παραγγελίες</h2>
          <table>
            <thead><tr><th>Ημ/νία</th><th>Κατάστημα</th><th>Προμηθευτής</th><th>Κατάσταση</th></tr></thead>
            <tbody>
              {pendingOrdersList.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_date}</td><td>{o.stores?.name}</td><td>{o.suppliers?.name}</td>
                  <td><span className="badge badge-warn">{o.status === 'draft' ? 'Πρόχειρη' : 'Απεστάλη'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stores.length === 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          Ξεκίνα προσθέτοντας τα καταστήματά σου στην καρτέλα <b>Καταστήματα</b>.
        </div>
      )}
    </div>
  )
}
