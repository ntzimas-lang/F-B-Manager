import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { logActivity } from '../lib/activity'

const ROLE_LABELS = {
  super_user: 'Super User',
  store_manager: 'Υπεύθυνος Καταστήματος',
  shift_manager: 'Υπεύθυνος Βάρδιας',
  accounting: 'Λογιστήριο',
}

export default function Users() {
  const { stores } = useStores()
  const { profile: myProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*, stores(name)').order('email')
    setUsers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateField(userRow, field, value) {
    setSavingId(userRow.id)
    const payload = { [field]: value || null }
    // Αν αλλάξει σε ρόλο που δεν είναι store_manager, καθαρίζουμε το store_id
    if (field === 'role' && value !== 'store_manager') payload.store_id = null
    await supabase.from('profiles').update(payload).eq('id', userRow.id)
    await logActivity('update', 'user', userRow.email, `${field} → ${value}`)
    await load()
    setSavingId(null)
  }

  if (myProfile?.role !== 'super_user') {
    return <div className="card">Αυτή η σελίδα είναι διαθέσιμη μόνο σε χρήστες με ρόλο Super User.</div>
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <h1>Χρήστες</h1>
      </div>

      <div className="card" style={{ marginBottom: 16, background: 'var(--olive-50)', fontSize: 13 }}>
        Για να προσθέσεις <b>νέο</b> χρήστη (email + κωδικός), αυτό γίνεται ακόμα από το Supabase:
        Authentication → Users → Add user (με "Auto Confirm User" ενεργό). Μόλις δημιουργηθεί, θα εμφανιστεί
        αυτόματα εδώ και θα μπορείς να του ορίσεις ρόλο και κατάστημα.
      </div>

      <div className="card">
        {loading ? <p>Φόρτωση...</p> : (
          <table>
            <thead><tr><th>Email</th><th>Ρόλος</th><th>Κατάστημα</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) => updateField(u, 'role', e.target.value)}
                    >
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === 'store_manager' ? (
                      <select
                        value={u.store_id || ''}
                        disabled={savingId === u.id}
                        onChange={(e) => updateField(u, 'store_id', e.target.value)}
                      >
                        <option value="">Επιλογή καταστήματος...</option>
                        {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: '#8a8a7a' }}>{u.role === 'super_user' ? 'Όλα' : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3}>Δεν υπάρχουν χρήστες ακόμα.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
