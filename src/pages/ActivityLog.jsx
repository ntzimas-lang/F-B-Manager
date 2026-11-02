import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

const ACTION_TONE = { create: 'badge-ok', update: 'badge-warn', delete: 'badge-danger' }

export default function ActivityLog() {
  const { t, lang } = useLanguage()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('all')

  const ACTION_LABELS = { create: t('created'), update: t('updated'), delete: t('deleted') }
  const ENTITY_LABELS = {
    store: t('entityStore'), recipe: t('entityRecipe'), ingredient: t('entityIngredient'), recipe_ingredient: t('entityRecipeIngredient'),
    supplier: t('entitySupplier'), order: t('entityOrder'), order_item: t('entityOrderItem'), stock_movement: t('entityStockMovement'),
    stocktake: t('entityStocktake'), employee: t('entityEmployee'), shift: t('entityShift'), sale: t('entitySale'), user: t('entityUser'), receipt: t('entityReceipt'),
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200)
    setLogs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filterAction === 'all' ? logs : logs.filter((l) => l.action === filterAction)

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>{t('activity')}</h1>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="all">{t('allActions')}</option>
          <option value="create">{t('creates')}</option>
          <option value="update">{t('updates')}</option>
          <option value="delete">{t('deletes')}</option>
        </select>
      </div>

      <div className="card">
        {loading ? <p>{t('loading')}</p> : (
          <table>
            <thead><tr><th>{t('dateTime')}</th><th>{t('user')}</th><th>{t('action')}</th><th>{t('type')}</th><th>{t('item')}</th></tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')}</td>
                  <td>{l.user_email || '—'}</td>
                  <td><span className={`badge ${ACTION_TONE[l.action] || 'badge-ok'}`}>{ACTION_LABELS[l.action] || l.action}</span></td>
                  <td>{ENTITY_LABELS[l.entity_type] || l.entity_type}</td>
                  <td>{l.entity_name || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}>{t('noActivity')}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
