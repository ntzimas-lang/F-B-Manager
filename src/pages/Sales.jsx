import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { logActivity } from '../lib/activity'

export default function Sales() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
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

    if (existingSale?.sale_items?.length) {
      for (const item of existingSale.sale_items) {
        await adjustStockForRecipe(item.recipe_id, item.quantity, +1)
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
        await adjustStockForRecipe(item.recipe_id, item.quantity, -1)
      }
    }

    await logActivity('create', 'sale', store?.name, `${t('sales')} ${date}: ${itemsToInsert.length}`)
    setSaving(false)
    load()
  }

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
          note: `${t('sales')}: ${recipes.find(r => r.id === recipeId)?.name || ''} x${quantitySold}`,
        })
      }
    }
  }

  const totalRevenue = Object.entries(quantities).reduce((sum, [recipeId, qty]) => {
    const recipe = recipes.find(r => r.id === recipeId)
    return sum + (recipe ? Number(recipe.selling_price) * (Number(qty) || 0) : 0)
  }, 0)

  if (!activeStoreId) return <div className="card">{t('addStoreFirst')}</div>

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('sales')} {store ? `— ${store.name}` : ''}</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {selectedStoreId === 'all' && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)' }}>
          {t('pickStoreNotice')}
        </div>
      )}
      {existingSale && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--ok)' }}>
          {t('existingSaleNotice').replace('{date}', date)}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t('sales')}</h2>
        {loading ? <p>{t('loading')}</p> : (
          <>
            <table>
              <thead><tr><th>{t('dishes')}</th><th>{t('price')}</th><th>{t('portions')}</th><th>{t('revenue')}</th></tr></thead>
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
                {recipes.length === 0 && <tr><td colSpan={4}>{t('noActiveDishes')}</td></tr>}
              </tbody>
            </table>

            {recipes.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <div>
                  <div className="stat-label">{t('totalRevenue')}</div>
                  <div className="stat-value">{totalRevenue.toFixed(2)} €</div>
                </div>
                <button className="btn" onClick={saveSales} disabled={saving}>
                  {saving ? t('saving') : existingSale ? t('updateSales') : t('recordSales')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {pastSales.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>{t('recentDays')}</h2>
          <table>
            <thead><tr><th>{t('date')}</th><th>{t('dishes')}</th><th>{t('totalRevenue')}</th></tr></thead>
            <tbody>
              {pastSales.map((s) => {
                const total = (s.sale_items || []).reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setDate(s.date)}>
                    <td>{s.date}</td>
                    <td>{(s.sale_items || []).reduce((sum, it) => sum + Number(it.quantity), 0)} {t('portions')}</td>
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
