import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ACTION_LABELS = { create: 'Δημιουργία', update: 'Ενημέρωση', delete: 'Διαγραφή' }
const ACTION_TONE = { create: 'badge-ok', update: 'badge-warn', delete: 'badge-danger' }

const ENTITY_LABELS = {
  store: 'Κατάστημα', recipe: 'Πιάτο', ingredient: 'Πρώτη Ύλη', recipe_ingredient: 'Σύνθεση Πιάτου',
  supplier: 'Προμηθευτής', order: 'Παραγγελία', order_item: 'Είδος Παραγγελίας', stock_movement: 'Κίνηση Αποθέματος',
  stocktake: 'Απογραφή', employee: 'Υπάλληλος', shift: 'Βάρδια',
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('all')

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
        <h1>Δραστηριότητα Χρηστών</h1>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="all">Όλες οι ενέργειες</option>
          <option value="create">Δημιουργίες</option>
          <option value="update">Ενημερώσεις</option>
          <option value="delete">Διαγραφές</option>
        </select>
      </div>

      <div className="card">
        {loading ? <p>Φόρτωση...</p> : (
          <table>
            <thead><tr><th>Ημ/νία & Ώρα</th><th>Χρήστης</th><th>Ενέργεια</th><th>Τύπος</th><th>Στοιχείο</th></tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('el-GR')}</td>
                  <td>{l.user_email || '—'}</td>
                  <td><span className={`badge ${ACTION_TONE[l.action] || 'badge-ok'}`}>{ACTION_LABELS[l.action] || l.action}</span></td>
                  <td>{ENTITY_LABELS[l.entity_type] || l.entity_type}</td>
                  <td>{l.entity_name || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}>Δεν υπάρχει ακόμα δραστηριότητα.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
