import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { Download } from 'lucide-react'
import PriceTrends from './PriceTrends'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { notoSansBase64 } from '../assets/notoSansFont'

const OLIVE_RGB = [61, 74, 40] // #3d4a28

export default function Dashboard() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
  const sid = selectedStoreId !== 'all' && stores.some(x => x.id === selectedStoreId) ? selectedStoreId : 'all'
  const scopeName = sid === 'all' ? t('companyTotal') : stores.find(x => x.id === sid)?.name
  const { hasFeature, hideCosts } = useAuth()
  const [monthRevenue, setMonthRevenue] = useState(0)
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
  const [monthPurchases, setMonthPurchases] = useState(0)
  const [recentReceipts, setRecentReceipts] = useState([])
  const [tab, setTab] = useState('overview')
  const canPrices = hasFeature('receiving') && !hideCosts
  const byStore = (q, col = 'store_id') => (sid === 'all' ? q : q.eq(col, sid))

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
        byStore(supabase.from('inventory_stock').select('*, ingredients(name, unit, current_price, min_stock_alert), stores(name)')),
        byStore(supabase.from('purchase_orders').select('*, stores(name), suppliers(name)').in('status', ['draft', 'sent']).order('order_date', { ascending: true })),
        supabase.from('recipes').select('*').eq('active', true),
        supabase.from('recipe_ingredients').select('*'),
        supabase.from('ingredients').select('*'),
        byStore(supabase.from('stock_movements').select('*, ingredients(name), stores(name)').order('created_at', { ascending: false }).limit(10)),
        supabase.from('stores').select('*').eq('active', true),
      ])

      if (hasFeature('sales')) {
        const first = new Date(); first.setDate(1)
        const { data: ms } = await byStore(supabase.from('sales').select('sale_items(quantity, unit_price)').gte('date', first.toISOString().slice(0, 10)))
        setMonthRevenue((ms || []).reduce((a, sl) => a + (sl.sale_items || []).reduce((b, it) => b + Number(it.quantity) * Number(it.unit_price), 0), 0))
      }

      if (hasFeature('receiving') && !hideCosts) {
        const f = new Date(); f.setDate(1)
        const { data: pi } = await byStore(supabase.from('goods_receipt_items')
          .select('quantity, unit_price, goods_receipts!inner(receipt_date, store_id)')
          .gte('goods_receipts.receipt_date', f.toISOString().slice(0, 10)).not('unit_price', 'is', null).limit(5000), 'goods_receipts.store_id')
        setMonthPurchases((pi || []).reduce((a, r) => a + Number(r.quantity) * Number(r.unit_price), 0))
      }
      if (hasFeature('receiving')) {
        const { data: rr } = await byStore(supabase.from('goods_receipts').select('*, stores(name), suppliers(name)').order('receipt_date', { ascending: false }).order('created_at', { ascending: false }).limit(10))
        setRecentReceipts(rr || [])
      }

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

      const summary = (allStores || []).filter(st => sid === 'all' || st.id === sid).map((st) => {
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
  }, [sid])

  function exportPDF() {
    const doc = new jsPDF()
    doc.addFileToVFS('NotoSans.ttf', notoSansBase64)
    doc.addFont('NotoSans.ttf', 'NotoSans', 'normal')
    doc.addFont('NotoSans.ttf', 'NotoSans', 'bold')
    doc.setFont('NotoSans', 'normal')

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
        hasFeature('recipes') && ['Πιάτα Μενού', String(stats.recipes)],
        hasFeature('ingredients') && ['Πρώτες Ύλες', String(stats.ingredients)],
        hasFeature('orders') && ['Προμηθευτές', String(stats.suppliers)],
        hasFeature('staff') && ['Υπάλληλοι', String(stats.employees)],
        hasFeature('costing') && ['Μέσο Food Cost %', `${stats.avgCostPct.toFixed(1)}%`],
        hasFeature('sales') && ['Έσοδα Μήνα', `${monthRevenue.toFixed(2)} €`],
        hasFeature('inventory') && !hideCosts && ['Αξία Αποθέματος', `${stats.inventoryValue.toFixed(2)} €`],
        hasFeature('inventory') && ['Χαμηλό Απόθεμα', String(stats.lowStock)],
        hasFeature('orders') && ['Εκκρεμείς Παραγγελίες', String(stats.pendingOrders)],
      ].filter(Boolean),
      theme: 'striped',
      headStyles: { fillColor: OLIVE_RGB, font: 'NotoSans' },
      styles: { font: 'NotoSans' },
    })
    y = doc.lastAutoTable.finalY + 10

    if (hasFeature('costing') && topCost.length > 0) {
      doc.text('Πιάτα με Υψηλότερο Food Cost %', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Πιάτο', 'Κόστος', 'Τιμή', 'Food Cost %']],
        body: topCost.map((r) => [r.name, `${r.cost.toFixed(2)} €`, `${Number(r.selling_price).toFixed(2)} €`, `${r.costPct.toFixed(1)}%`]),
        theme: 'striped',
        headStyles: { fillColor: OLIVE_RGB, font: 'NotoSans' },
        styles: { font: 'NotoSans' },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    if (storeSummary.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; doc.setFont('NotoSans', 'normal') }
      doc.text('Σύνοψη ανά Κατάστημα', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Κατάστημα', ...(hasFeature('inventory') ? ['Αξία Αποθέματος', 'Χαμηλό Απόθεμα'] : []), ...(hasFeature('orders') ? ['Εκκρεμείς Παραγγελίες'] : [])]],
        body: storeSummary.map((s) => [s.name, ...(hasFeature('inventory') ? [`${s.value.toFixed(2)} €`, String(s.lowStock)] : []), ...(hasFeature('orders') ? [String(s.pending)] : [])]),
        theme: 'striped',
        headStyles: { fillColor: OLIVE_RGB, font: 'NotoSans' },
        styles: { font: 'NotoSans' },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    if (hasFeature('inventory') && lowStockList.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; doc.setFont('NotoSans', 'normal') }
      doc.text('Χαμηλό Απόθεμα — Λεπτομέρειες', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Πρώτη Ύλη', 'Κατάστημα', 'Ποσότητα', 'Όριο']],
        body: lowStockList.map((s) => [s.ingredients?.name, s.stores?.name, `${s.quantity} ${s.ingredients?.unit}`, String(s.ingredients?.min_stock_alert)]),
        theme: 'striped',
        headStyles: { fillColor: OLIVE_RGB, font: 'NotoSans' },
        styles: { font: 'NotoSans' },
      })
    }

    doc.save(`fb-manager-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const TABS = [
    ['overview', t('overview'), true],
    ['stock', t('stockTab'), hasFeature('inventory')],
    ['cost', t('costPricesTab'), hasFeature('costing') || canPrices],
    ['orders', t('ordersReceiptsTab'), hasFeature('orders') || hasFeature('receiving')],
  ].filter(x => x[2])

  const stockTable = (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('lowStock')}</h2>
      {loading ? <p>{t('loading')}</p> : lowStockList.length === 0 ? <p>—</p> : (
        <table>
          <thead><tr><th>{t('ingredient')}</th>{sid === 'all' && <th>{t('store')}</th>}<th>{t('quantity')}</th></tr></thead>
          <tbody>{lowStockList.map(x => (
            <tr key={x.id}><td>{x.ingredients?.name}</td>{sid === 'all' && <td>{x.stores?.name}</td>}<td><span className="badge badge-danger">{x.quantity} {x.ingredients?.unit}</span></td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{t('dashboard')}</h1>
          <div style={{ fontSize: 14, color: '#6b6b5f', marginTop: 2 }}>{scopeName}</div>
        </div>
        {tab === 'overview' && <button className="btn" onClick={exportPDF}><Download size={16} /> {t('exportPdf')}</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'btn' : 'btn btn-outline'} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === 'overview' && (<>
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          {hasFeature('sales') && <div className="card"><div className="stat-label">{t('monthRevenue')}</div><div className="stat-value">{monthRevenue.toFixed(0)} €</div></div>}
          {hasFeature('receiving') && !hideCosts && <div className="card"><div className="stat-label">{t('monthPurchases')}</div><div className="stat-value">{monthPurchases.toFixed(0)} €</div></div>}
          {hasFeature('costing') && <div className="card"><div className="stat-label">{t('avgFoodCost')}</div><div className="stat-value">{stats.avgCostPct.toFixed(1)}%</div></div>}
          {hasFeature('inventory') && !hideCosts && <div className="card"><div className="stat-label">{t('inventoryValue')}</div><div className="stat-value">{stats.inventoryValue.toFixed(0)} €</div></div>}
          {hasFeature('inventory') && (
            <div className="card">
              <div className="stat-label">{t('lowStock')}</div>
              <div className="stat-value" style={{ color: stats.lowStock > 0 ? 'var(--danger)' : 'var(--ok)' }}>{stats.lowStock}</div>
            </div>
          )}
          {hasFeature('orders') && <div className="card"><div className="stat-label">{t('pendingOrders')}</div><div className="stat-value">{stats.pendingOrders}</div></div>}
        </div>

        {sid === 'all' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>{t('storeSummary')}</h2>
            {loading ? <p>{t('loading')}</p> : storeSummary.length === 0 ? <p>{t('noStores')}</p> : (
              <table>
                <thead><tr><th>{t('store')}</th>{hasFeature('inventory') && <>{!hideCosts && <th>{t('inventoryValue')}</th>}<th>{t('lowStock')}</th></>}{hasFeature('orders') && <th>{t('pendingOrders')}</th>}</tr></thead>
                <tbody>
                  {storeSummary.map((x) => (
                    <tr key={x.name}>
                      <td>{x.name}</td>
                      {hasFeature('inventory') && <>{!hideCosts && <td>{x.value.toFixed(2)} €</td>}
                      <td>{x.lowStock > 0 ? <span className="badge badge-danger">{x.lowStock}</span> : <span className="badge badge-ok">0</span>}</td></>}
                      {hasFeature('orders') && <td>{x.pending > 0 ? <span className="badge badge-warn">{x.pending}</span> : <span className="badge badge-ok">0</span>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {stores.length === 0 && <div className="card">{t('addStoreFirst')}</div>}
      </>)}

      {tab === 'stock' && hasFeature('inventory') && (<>
        {stockTable}
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>{t('recentActivity')}</h2>
          {loading ? <p>{t('loading')}</p> : recentMovements.length === 0 ? <p>—</p> : (
            <table>
              <thead><tr><th>{t('ingredients')}</th>{sid === 'all' && <th>{t('store')}</th>}<th>{t('type')}</th><th>{t('quantity')}</th></tr></thead>
              <tbody>
                {recentMovements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.ingredients?.name}</td>{sid === 'all' && <td>{m.stores?.name}</td>}
                    <td>{m.movement_type === 'receipt' ? t('receipt') : m.movement_type === 'waste' ? t('waste') : m.movement_type === 'consumption' ? t('consumption') : t('adjustment')}</td>
                    <td style={{ color: m.quantity < 0 ? 'var(--danger)' : 'var(--ok)' }}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>)}

      {tab === 'cost' && (<>
        {hasFeature('costing') && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>{t('topFoodCost')}</h2>
            {loading ? <p>{t('loading')}</p> : topCost.length === 0 ? <p>—</p> : (
              <table>
                <thead><tr><th>{t('dishes')}</th><th>{t('foodCostPct')}</th></tr></thead>
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
        )}
        {canPrices && <PriceTrends />}
      </>)}

      {tab === 'orders' && (<>
        {hasFeature('orders') && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>{t('upcomingOrders')}</h2>
            {pendingOrdersList.length === 0 ? <p>—</p> : (
              <table>
                <thead><tr><th>{t('date')}</th>{sid === 'all' && <th>{t('store')}</th>}<th>{t('supplier')}</th><th>{t('status')}</th></tr></thead>
                <tbody>
                  {pendingOrdersList.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_date}</td>{sid === 'all' && <td>{o.stores?.name}</td>}<td>{o.suppliers?.name}</td>
                      <td><span className="badge badge-warn">{o.status === 'draft' ? t('draft') : t('sent')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {hasFeature('receiving') && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{t('recentReceipts')}</h2>
            {recentReceipts.length === 0 ? <p>—</p> : (
              <table>
                <thead><tr><th>{t('date')}</th>{sid === 'all' && <th>{t('store')}</th>}<th>{t('supplier')}</th><th>{t('invoiceNumber')}</th></tr></thead>
                <tbody>
                  {recentReceipts.map((r) => (
                    <tr key={r.id}><td>{r.receipt_date}</td>{sid === 'all' && <td>{r.stores?.name}</td>}<td>{r.suppliers?.name || '—'}</td><td>{r.invoice_number || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </>)}
    </div>
  )
}
