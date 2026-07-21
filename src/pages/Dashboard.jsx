import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'

export default function Dashboard() {
  const { stores } = useStores()
  const [stats, setStats] = useState({ recipes:0, ingredients:0, lowStock:0, pendingOrders:0, avgCostPct:0 })

  useEffect(() => {
    async function load() {
      const [{ count: recipeCount }, { count: ingCount }, { data: stock }, { count: pendingOrders }, { data: recipes }, { data: links }, { data: ingredients }] = await Promise.all([
        supabase.from('recipes').select('*', { count:'exact', head:true }),
        supabase.from('ingredients').select('*', { count:'exact', head:true }),
        supabase.from('inventory_stock').select('*, ingredients(min_stock_alert)'),
        supabase.from('purchase_orders').select('*', { count:'exact', head:true }).in('status', ['draft','sent']),
        supabase.from('recipes').select('*').eq('active', true),
        supabase.from('recipe_ingredients').select('*'),
        supabase.from('ingredients').select('*'),
      ])

      const lowStock = (stock || []).filter(s => s.ingredients?.min_stock_alert > 0 && s.quantity <= s.ingredients.min_stock_alert).length

      const ingMap = Object.fromEntries((ingredients || []).map(i => [i.id, i]))
      const costPcts = (recipes || []).map(r => {
        const recLinks = (links || []).filter(l => l.recipe_id === r.id)
        const cost = recLinks.reduce((sum, l) => sum + (ingMap[l.ingredient_id]?.current_price * l.quantity || 0), 0)
        return r.selling_price > 0 ? (cost / r.selling_price) * 100 : null
      }).filter(v => v !== null)
      const avgCostPct = costPcts.length ? costPcts.reduce((a,b)=>a+b,0)/costPcts.length : 0

      setStats({ recipes: recipeCount || 0, ingredients: ingCount || 0, lowStock, pendingOrders: pendingOrders || 0, avgCostPct })
    }
    load()
  }, [])

  return (
    <div>
      <h1 style={{marginBottom:20}}>Πίνακας Ελέγχου</h1>
      <div className="grid grid-4" style={{marginBottom:20}}>
        <div className="card"><div className="stat-label">Καταστήματα</div><div className="stat-value">{stores.length}</div></div>
        <div className="card"><div className="stat-label">Πιάτα Μενού</div><div className="stat-value">{stats.recipes}</div></div>
        <div className="card"><div className="stat-label">Πρώτες Ύλες</div><div className="stat-value">{stats.ingredients}</div></div>
        <div className="card"><div className="stat-label">Μέσο Food Cost %</div><div className="stat-value">{stats.avgCostPct.toFixed(1)}%</div></div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="stat-label">Χαμηλό Απόθεμα</div>
          <div className="stat-value" style={{color: stats.lowStock > 0 ? 'var(--danger)' : 'var(--ok)'}}>{stats.lowStock}</div>
        </div>
        <div className="card">
          <div className="stat-label">Εκκρεμείς Παραγγελίες</div>
          <div className="stat-value" style={{color: stats.pendingOrders > 0 ? 'var(--warn)' : 'var(--ok)'}}>{stats.pendingOrders}</div>
        </div>
      </div>
    </div>
  )
}
