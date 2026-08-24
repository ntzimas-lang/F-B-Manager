import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

export default function Costing() {
  const { t } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('costPct')

  useEffect(() => {
    async function load() {
      const [{ data: recipes }, { data: links }, { data: ingredients }] = await Promise.all([
        supabase.from('recipes').select('*').eq('active', true),
        supabase.from('recipe_ingredients').select('*'),
        supabase.from('ingredients').select('*'),
      ])
      const ingMap = Object.fromEntries((ingredients || []).map(i => [i.id, i]))
      const computed = (recipes || []).map(r => {
        const recLinks = (links || []).filter(l => l.recipe_id === r.id)
        const cost = recLinks.reduce((sum, l) => {
          const ing = ingMap[l.ingredient_id]
          return sum + (ing ? ing.current_price * l.quantity : 0)
        }, 0)
        const costPct = r.selling_price > 0 ? (cost / r.selling_price) * 100 : 0
        const margin = r.selling_price - cost
        return { ...r, cost, costPct, margin, ingredientCount: recLinks.length }
      })
      setRows(computed)
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'costPct') return b.costPct - a.costPct
    if (sortBy === 'margin') return a.margin - b.margin
    return a.name.localeCompare(b.name)
  })

  const alerts = rows.filter(r => r.costPct > 35 || r.ingredientCount === 0)
  const avgCostPct = rows.length ? rows.reduce((s, r) => s + r.costPct, 0) / rows.length : 0

  return (
    <div>
      <h1 style={{marginBottom:20}}>{t('costing')}</h1>

      <div className="grid grid-4" style={{marginBottom:20}}>
        <div className="card">
          <div className="stat-label">{t('totalRecipes')}</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">{t('avgFoodCost')}</div>
          <div className="stat-value">{avgCostPct.toFixed(1)}%</div>
        </div>
        <div className="card">
          <div className="stat-label">{t('highCostDishes')}</div>
          <div className="stat-value" style={{color:'var(--danger)'}}>{rows.filter(r=>r.costPct>35).length}</div>
        </div>
        <div className="card">
          <div className="stat-label">{t('noComposition')}</div>
          <div className="stat-value" style={{color:'var(--warn)'}}>{rows.filter(r=>r.ingredientCount===0).length}</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card" style={{marginBottom:20, borderColor:'var(--warn)'}}>
          <h2 style={{marginTop:0}}>⚠ {t('alerts')}</h2>
          <ul style={{margin:0, paddingRight:20}}>
            {alerts.map(r => (
              <li key={r.id}>
                {r.name}: {r.ingredientCount === 0 ? t('noRecipeText') : `food cost ${r.costPct.toFixed(1)}% — ${t('lowMarginText')}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
          <h2 style={{margin:0}}>{t('dishAnalysis')}</h2>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="costPct">{t('sortByCostPct')}</option>
            <option value="margin">{t('sortByMargin')}</option>
            <option value="name">{t('sortByName')}</option>
          </select>
        </div>
        {loading ? <p>{t('loading')}</p> : (
          <table>
            <thead><tr><th>{t('dishes')}</th><th>{t('cost')}</th><th>{t('sellingPrice')}</th><th>{t('margin')}</th><th>{t('foodCostPct')}</th><th>{t('condition')}</th></tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.cost.toFixed(2)} €</td>
                  <td>{Number(r.selling_price).toFixed(2)} €</td>
                  <td>{r.margin.toFixed(2)} €</td>
                  <td>{r.costPct.toFixed(1)}%</td>
                  <td>
                    {r.ingredientCount === 0 ? <span className="badge badge-warn">{t('noCompositionBadge')}</span> :
                     r.costPct > 35 ? <span className="badge badge-danger">{t('highCostBadge')}</span> :
                     r.costPct > 28 ? <span className="badge badge-warn">{t('marginalBadge')}</span> :
                     <span className="badge badge-ok">{t('goodBadge')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
