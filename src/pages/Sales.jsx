import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { logActivity } from '../lib/activity'

export default function Sales() {
  const { stores, selectedStoreId } = useStores()
  const activeStoreId = selectedStoreId !== 'all' ? selectedStoreId : (stores[0]?.id || '')
  const store = stores.find(s => s.id === activeStoreId)

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [recipes, setRecipes] = useState([])
  const [recipeLinks, setRecipeLinks] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [quantities, setQuantities] = useState({})
  const [existingSale, setExistingSale] = useState(null)
  const [pastSales, setPastSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!activeStoreId) { setLoading(false); return }
    setLoading(true)
    const [{ data: r }, { data: links }, { data: ing }, { data: sale }, { data: past }] = await Promise.all([
      supabase.from('recipes').select('*').eq('active', true).order('name'),
      supabase.from('recipe_ingredients').select('*'),
      supabase.from('ingredients').select('*'),
      supabase.from('sales').select('*, sale_items(*)').eq('store_id', activeStoreId).eq('date', date).maybeSingle(),
      supabase.from('sales').select('*, sale_items(*)').eq('store_id', activeStoreId).order('date', { ascending: false }).limit(10),
    ])
    setRecipes(r || [])
    setRecipeLinks(links || [])
    setIngredients(ing || [])
    setExistingSale(sale || null)
    setPastSales(past || [])
    // προ-συμπλήρωση αν υπάρχει ήδη καταχώρηση για αυτή την ημέρα
    if (sale?.sale_items) {
      setQuantities(Object.fromEntries(sale.sale_items.map(si => [si.recipe_id, String(si.quantity)])))
    } else {
      setQuantities({})
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [activeStoreId, date])

  async function saveSales() {
    if (!activeStoreId) return
    setSaving(true)

    // Αν υπάρχει ήδη καταχώρηση για αυτή τη μέρα, πρώτα επαναφέρουμε το προηγούμενο απόθεμα
    // (αναιρούμε την παλιά ανάλωση) πριν εφαρμόσουμε τη νέα, ώστε να μην αφαιρεθεί διπλά.
    if (existingSale?.sale_items?.length) {
      for (const item of existingSale.sale_items) {
        await adjustStockForRecipe(item.recipe_id, item.quantity, +1) // επαναφορά (+)
      }
      await supabase.from('sale_items').delete().eq('sale_id', existingSale.id)
    }

    let saleId = existingSale?.id
    if (!saleId) {
      const { data } = await supabase.from('sales').insert({ store_id: activeStoreId, date }).select().single()
      saleId = data.id
    }

    const itemsToInsert = Object.entries(quantities)
      .filter(([, qty]) => qty && Number(qty) > 0)
      .map(([recipeId, qty]) => {
        const recipe = recipes.find(r => r.id === recipeId)
        return { sale_id: saleId, recipe_id: recipeId, quantity: Number(qty), unit_price: recipe?.selling_price || 0 }
      })

    if (itemsToInsert.length > 0) {
      await supabase.from('sale_items').insert(itemsToInsert)
      for (const item of itemsToInsert) {
        await adjustStockForRecipe(item.recipe_id, item.quantity, -1) // αφαίρεση (-)
      }
    }

    await logActivity('create', 'sale', store?.name, `Πωλήσεις ${date}: ${itemsToInsert.length} πιάτα`)
    setSaving(false)
    load()
  }

  // Αφαιρεί (direction=-1) ή επαναφέρει (direction=+1) τις πρώτες ύλες μιας συνταγής από το απόθεμα
  async function adjustStockForRecipe(recipeId, quantitySold, direction) {
    const links = recipeLinks.filter(l => l.recipe_id === recipeId)
    for (const link of links) {
      const delta = link.quantity * quantitySold * direction
      const { data: stockRow } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('store_id', activeStoreId)
        .eq('ingredient_id', link.ingredient_id)
        .maybeSingle()

      if (stockRow) {
        const newQty = Number(stockRow.quantity) + delta
        await supabase.from('inventory_stock').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', stockRow.id)
      } else if (direction === -1) {
        await supabase.from('inventory_stock').insert({ store_id: activeStoreId, ingredient_id: link.ingredient_id, quantity: delta })
      }

      if (direction === -1) {
        const ing = ingredients.find(i => i.id === link.ingredient_id)
        await supabase.from('stock_movements').insert({
          store_id: activeStoreId,
          ingredient_id: link.ingredient_id,
          movement_type: 'consumption',
          quantity: delta,
          note: `Πώληση: ${recipes.find(r => r.id === recipeId)?.name || ''} x${quantitySold}`,
        })
      }
    }
  }

  const totalRevenue = Object.entries(quantities).reduce((sum, [recipeId, qty]) => {
    const recipe = recipes.find(r => r.id === recipeId)
    return sum + (recipe ? Number(recipe.selling_price) * (Number(qty) || 0) : 0)
  }, 0)

  if (!activeStoreId) return <div className="card">Πρόσθεσε πρώτα ένα κατάστημα για να καταχωρήσεις πωλήσεις.</div>

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>Πωλήσεις {store ? `— ${store.name}` : ''}</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {selectedStoreId === 'all' && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)' }}>
          Επίλεξε συγκεκριμένο κατάστημα πάνω δεξιά. Προς το παρόν δείχνει το πρώτο κατάστημα.
        </div>
      )}
      {existingSale && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--ok)' }}>
          Υπάρχει ήδη καταχώρηση πωλήσεων για {date}. Η αποθήκευση θα ενημερώσει την υπάρχουσα εγγραφή (χωρίς διπλή αφαίρεση αποθέματος).
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Πωλήσεις</h2>
        {loading ? <p>Φόρτωση...</p> : (
          <>
            <table>
              <thead><tr><th>Πιάτο</th><th>Τιμή</th><th>Μερίδες</th><th>Έσοδα</th></tr></thead>
              <tbody>
                {recipes.map((r) => {
                  const qty = Number(quantities[r.id]) || 0
                  return (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{Number(r.selling_price).toFixed(2)} €</td>
                      <td>
                        <input
                          type="number" min="0" step="1" style={{ width: 90 }}
                          value={quantities[r.id] ?? ''}
                          onChange={(e) => setQuantities({ ...quantities, [r.id]: e.target.value })}
                        />
                      </td>
                      <td>{(qty * r.selling_price).toFixed(2)} €</td>
                    </tr>
                  )
                })}
                {recipes.length === 0 && <tr><td colSpan={4}>Δεν υπάρχουν ενεργά πιάτα στο μενού ακόμα.</td></tr>}
              </tbody>
            </table>

            {recipes.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <div>
                  <div className="stat-label">Σύνολο Εσόδων Ημέρας</div>
                  <div className="stat-value">{totalRevenue.toFixed(2)} €</div>
                </div>
                <button className="btn" onClick={saveSales} disabled={saving}>
                  {saving ? 'Αποθήκευση...' : existingSale ? 'Ενημέρωση Πωλήσεων' : 'Καταχώρηση Πωλήσεων'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {pastSales.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Πρόσφατες Ημέρες</h2>
          <table>
            <thead><tr><th>Ημερομηνία</th><th>Πιάτα</th><th>Σύνολο Εσόδων</th></tr></thead>
            <tbody>
              {pastSales.map((s) => {
                const total = (s.sale_items || []).reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setDate(s.date)}>
                    <td>{s.date}</td>
                    <td>{(s.sale_items || []).reduce((sum, it) => sum + Number(it.quantity), 0)} μερίδες</td>
                    <td>{total.toFixed(2)} €</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
