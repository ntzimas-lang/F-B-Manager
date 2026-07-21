import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStores } from '../context/StoreContext'
import { Plus, X, Trash2, Download } from 'lucide-react'

function shiftHours(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return mins / 60
}

export default function Staff() {
  const { stores, selectedStoreId } = useStores()
  const [subTab, setSubTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [showShiftForm, setShowShiftForm] = useState(false)

  async function load() {
    let eq = supabase.from('employees').select('*, stores(name)').order('name')
    if (selectedStoreId !== 'all') eq = eq.eq('store_id', selectedStoreId)
    let sq = supabase.from('shifts').select('*').gte('date', `${month}-01`).lte('date', `${month}-31`)
    if (selectedStoreId !== 'all') sq = sq.eq('store_id', selectedStoreId)
    const [{ data: emp }, { data: sh }] = await Promise.all([eq, sq])
    setEmployees(emp || [])
    setShifts(sh || [])
  }
  useEffect(() => { load() }, [selectedStoreId, month])

  async function deleteEmployee(id) {
    if (!confirm('Διαγραφή υπαλλήλου;')) return
    await supabase.from('employees').delete().eq('id', id)
    load()
  }
  async function deleteShift(id) {
    await supabase.from('shifts').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}><h1>Προσωπικό & Βάρδιες</h1></div>

      <div style={{display:'flex', gap:8, marginBottom:20}}>
        <button className={subTab==='employees' ? 'btn' : 'btn btn-outline'} onClick={() => setSubTab('employees')}>Προσωπικό</button>
        <button className={subTab==='shifts' ? 'btn' : 'btn btn-outline'} onClick={() => setSubTab('shifts')}>Πρόγραμμα Βαρδιών</button>
        <button className={subTab==='payroll' ? 'btn' : 'btn btn-outline'} onClick={() => setSubTab('payroll')}>Μισθοδοσία</button>
      </div>

      {subTab === 'employees' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2 style={{margin:0}}>Υπάλληλοι ({employees.length})</h2>
            <button className="btn" onClick={() => setShowEmpForm(true)}><Plus size={16}/> Νέος Υπάλληλος</button>
          </div>
          <table>
            <thead><tr><th>Όνομα</th><th>Ρόλος</th><th>Κατάστημα</th><th>Ωρομίσθιο</th><th></th></tr></thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id}>
                  <td>{e.name}</td><td>{e.role}</td><td>{e.stores?.name}</td>
                  <td>{Number(e.hourly_rate).toFixed(2)} €/ώρα</td>
                  <td><button className="icon-btn danger" onClick={() => deleteEmployee(e.id)}><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν υπάλληλοι ακόμα.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'shifts' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2 style={{margin:0}}>Βάρδιες — {month}</h2>
            <div style={{display:'flex', gap:8}}>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
              <button className="btn" onClick={() => setShowShiftForm(true)}><Plus size={16}/> Νέα Καταχώρηση</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Ημερομηνία</th><th>Υπάλληλος</th><th>Τύπος</th><th>Ώρες</th><th></th></tr></thead>
            <tbody>
              {shifts.sort((a,b) => a.date.localeCompare(b.date)).map(sh => {
                const emp = employees.find(e => e.id === sh.employee_id) || {}
                const hours = sh.type === 'shift' && sh.start_time && sh.end_time ? shiftHours(sh.start_time, sh.end_time) : 0
                return (
                  <tr key={sh.id}>
                    <td>{sh.date}</td><td>{emp.name || '-'}</td>
                    <td>
                      {sh.type === 'shift' ? <span className="badge badge-ok">Βάρδια {sh.start_time?.slice(0,5)}-{sh.end_time?.slice(0,5)}</span> :
                       sh.type === 'leave' ? <span className="badge badge-warn">Άδεια</span> : <span className="badge badge-warn">Ρεπό</span>}
                    </td>
                    <td>{hours ? `${hours.toFixed(1)} ώρες` : '-'}</td>
                    <td><button className="icon-btn danger" onClick={() => deleteShift(sh.id)}><Trash2 size={14}/></button></td>
                  </tr>
                )
              })}
              {shifts.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν καταχωρήσεις για {month}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'payroll' && <Payroll employees={employees} shifts={shifts} month={month} setMonth={setMonth} />}

      {showEmpForm && <EmployeeFormModal stores={stores} onClose={() => setShowEmpForm(false)} onSaved={() => { setShowEmpForm(false); load() }} />}
      {showShiftForm && <ShiftFormModal stores={stores} selectedStoreId={selectedStoreId} onClose={() => setShowShiftForm(false)} onSaved={() => { setShowShiftForm(false); load() }} />}
    </div>
  )
}

function EmployeeFormModal({ stores, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', role:'', store_id:'', hourly_rate:'' })
  async function save() {
    if (!form.name || !form.store_id) return
    await supabase.from('employees').insert({ ...form, hourly_rate: Number(form.hourly_rate) || 0, active: true })
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέος Υπάλληλος</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Όνομα</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>Ρόλος</label><input value={form.role} placeholder="π.χ. Σερβιτόρος, Μάγειρας" onChange={e => setForm({...form, role:e.target.value})}/></div>
        <div className="form-row"><label>Κατάστημα</label>
          <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value})}>
            <option value="">Επιλογή...</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Ωρομίσθιο (€)</label><input type="number" step="0.01" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}

function ShiftFormModal({ stores, selectedStoreId, onClose, onSaved }) {
  const [form, setForm] = useState({ employee_id:'', store_id: selectedStoreId !== 'all' ? selectedStoreId : '', date: new Date().toISOString().slice(0,10), type:'shift', start_time:'09:00', end_time:'17:00', notes:'' })
  const [empOptions, setEmpOptions] = useState([])

  useEffect(() => {
    async function loadEmp() {
      let q = supabase.from('employees').select('*').order('name')
      if (form.store_id) q = q.eq('store_id', form.store_id)
      const { data } = await q
      setEmpOptions(data || [])
    }
    loadEmp()
  }, [form.store_id])

  async function save() {
    if (!form.employee_id || !form.store_id) return
    const payload = { ...form }
    if (payload.type !== 'shift') { payload.start_time = null; payload.end_time = null }
    await supabase.from('shifts').insert(payload)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέα Καταχώρηση Βάρδιας</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Κατάστημα</label>
          <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value, employee_id:''})}>
            <option value="">Επιλογή...</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Υπάλληλος</label>
          <select value={form.employee_id} onChange={e => setForm({...form, employee_id:e.target.value})}>
            <option value="">Επιλογή...</option>
            {empOptions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Ημερομηνία</label><input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})}/></div>
        <div className="form-row"><label>Τύπος</label>
          <select value={form.type} onChange={e => setForm({...form, type:e.target.value})}>
            <option value="shift">Βάρδια</option><option value="leave">Άδεια</option><option value="dayoff">Ρεπό</option>
          </select>
        </div>
        {form.type === 'shift' && (
          <div style={{display:'flex', gap:8}}>
            <div className="form-row" style={{flex:1}}><label>Ώρα Έναρξης</label><input type="time" value={form.start_time} onChange={e => setForm({...form, start_time:e.target.value})}/></div>
            <div className="form-row" style={{flex:1}}><label>Ώρα Λήξης</label><input type="time" value={form.end_time} onChange={e => setForm({...form, end_time:e.target.value})}/></div>
          </div>
        )}
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}

function Payroll({ employees, shifts, month, setMonth }) {
  const rows = employees.map(e => {
    const empShifts = shifts.filter(s => s.employee_id === e.id)
    const hoursWorked = empShifts.filter(s => s.type === 'shift').reduce((sum, s) => sum + (s.start_time && s.end_time ? shiftHours(s.start_time, s.end_time) : 0), 0)
    const leaveDays = empShifts.filter(s => s.type === 'leave').length
    const dayoffDays = empShifts.filter(s => s.type === 'dayoff').length
    const pay = hoursWorked * Number(e.hourly_rate || 0)
    return { ...e, hoursWorked, leaveDays, dayoffDays, pay }
  })
  const totalPay = rows.reduce((s, r) => s + r.pay, 0)

  function exportCSV() {
    const csvRows = [['Υπάλληλος', 'Κατάστημα', 'Ρόλος', 'Ώρες Εργασίας', 'Ημέρες Άδειας', 'Ημέρες Ρεπό', 'Ωρομίσθιο', 'Μικτά Δεδουλευμένα']]
    rows.forEach(r => csvRows.push([r.name, r.stores?.name || '', r.role, r.hoursWorked.toFixed(2), r.leaveDays, r.dayoffDays, Number(r.hourly_rate).toFixed(2), r.pay.toFixed(2)]))
    csvRows.push(['', '', '', '', '', '', 'ΣΥΝΟΛΟ', totalPay.toFixed(2)])
    const csv = csvRows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `misthodosia-${month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
        <h2 style={{margin:0}}>Μισθοδοσία — {month}</h2>
        <div style={{display:'flex', gap:8}}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn" onClick={exportCSV}><Download size={16}/> Export CSV</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Υπάλληλος</th><th>Κατάστημα</th><th>Ώρες</th><th>Άδειες</th><th>Ρεπό</th><th>Ωρομίσθιο</th><th>Μικτά Δεδουλευμένα</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{r.stores?.name}</td>
              <td>{r.hoursWorked.toFixed(1)}</td><td>{r.leaveDays}</td><td>{r.dayoffDays}</td>
              <td>{Number(r.hourly_rate).toFixed(2)} €</td>
              <td><b>{r.pay.toFixed(2)} €</b></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>Δεν υπάρχουν υπάλληλοι ακόμα.</td></tr>}
        </tbody>
      </table>
      <div style={{marginTop:16}}>
        <div className="stat-label">Σύνολο Μισθοδοσίας</div>
        <div className="stat-value">{totalPay.toFixed(2)} €</div>
      </div>
    </div>
  )
}
