import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activity'
import { useStores } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { Plus, X, Trash2, Download, Pencil } from 'lucide-react'
import { exportXlsx } from '../lib/exportExcel'
import Schedule from './Schedule'
import { span, ISO_SHORT, normTime } from '../lib/schedule'

function shiftHours(start, end) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return mins / 60
}

export default function Staff() {
  const { stores, selectedStoreId } = useStores()
  const { t } = useLanguage()
  const { hideCosts } = useAuth()
  const [subTab, setSubTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)

  async function load() {
    let eq = supabase.from('employees').select('*, stores(name)').order('name')
    if (selectedStoreId !== 'all') eq = eq.eq('store_id', selectedStoreId)
    const { data: emp } = await eq
    setEmployees(emp || [])
  }
  useEffect(() => { load() }, [selectedStoreId])

  async function deleteEmployee(id) {
    if (!confirm(t('confirmDelete'))) return
    const emp = employees.find(e => e.id === id)
    await supabase.from('employees').delete().eq('id', id)
    await logActivity('delete', 'employee', emp?.name)
    load()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom:16}}><h1>{t('staff')}</h1></div>

      <div style={{display:'flex', gap:8, marginBottom:20}}>
        <button className={subTab==='employees' ? 'btn' : 'btn btn-outline'} onClick={() => setSubTab('employees')}>{t('employees')}</button>
        <button className={subTab==='shifts' ? 'btn' : 'btn btn-outline'} onClick={() => setSubTab('shifts')}>{t('shifts')}</button>
        {!hideCosts && <button className={subTab==='payroll' ? 'btn' : 'btn btn-outline'} onClick={() => setSubTab('payroll')}>{t('payroll')}</button>}
      </div>

      {subTab === 'employees' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2 style={{margin:0}}>{t('employees')} ({employees.length})</h2>
            <button className="btn write-master" onClick={() => { setEditEmployee(null); setShowEmpForm(true) }}><Plus size={16}/> {t('newEmployee')}</button>
          </div>
          <table>
            <thead><tr><th>{t('name')}</th><th>{t('role')}</th><th>{t('store')}</th>{!hideCosts && <th>{t('hourlyRate')}</th>}<th></th></tr></thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id}>
                  <td>{e.name}</td><td>{e.role}</td><td>{e.stores?.name}</td>
                  {!hideCosts && <td>{Number(e.hourly_rate).toFixed(2)} €{t('perHour')}</td>}
                  <td style={{display:'flex', gap:8}}>
                    <button className="icon-btn write-master" onClick={() => { setEditEmployee(e); setShowEmpForm(true) }}><Pencil size={16}/></button>
                    <button className="icon-btn danger write-master" onClick={() => deleteEmployee(e.id)}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5}>{t('noEmployees')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'shifts' && <Schedule />}

      {subTab === 'payroll' && !hideCosts && <Payroll employees={employees} month={month} setMonth={setMonth} />}

      {showEmpForm && <EmployeeFormModal stores={stores} employee={editEmployee} onClose={() => setShowEmpForm(false)} onSaved={() => { setShowEmpForm(false); load() }} />}
    </div>
  )
}

function EmployeeFormModal({ stores, employee, onClose, onSaved }) {
  const { t } = useLanguage()
  const isEdit = !!employee
  const [form, setForm] = useState({
    name: employee?.name || '', role: employee?.role || '',
    store_id: employee?.store_id || '', hourly_rate: employee?.hourly_rate ?? '',
    code: employee?.code || '', kind: employee?.kind || 'shift', fixed_time: employee?.fixed_time || '', fixed_days: employee?.fixed_days || [1,2,3,4,5],
  })
  async function save() {
    if (!form.name || !form.store_id) return
    const ft = form.kind === 'fixed' ? normTime(form.fixed_time) : null
    if (form.kind === 'fixed' && !ft) { alert('Γράψε το ωράριο σαν 07:00-15:00'); return }
    const payload = { ...form, fixed_time: ft, hourly_rate: Number(form.hourly_rate) || 0 }
    if (isEdit) {
      await supabase.from('employees').update(payload).eq('id', employee.id)
      await logActivity('update', 'employee', form.name)
    } else {
      await supabase.from('employees').insert({ ...payload, active: true })
      await logActivity('create', 'employee', form.name)
    }
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{isEdit ? `${t('edit')} — ${employee.name}` : t('newEmployee')}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>{t('name')}</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>{t('role')}</label><input value={form.role} onChange={e => setForm({...form, role:e.target.value})}/></div>
        <div className="form-row"><label>{t('store')}</label>
          <select value={form.store_id} onChange={e => setForm({...form, store_id:e.target.value})}>
            <option value="">{t('selectOption')}</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Κωδικός</label><input value={form.code} onChange={e => setForm({...form, code:e.target.value})}/></div>
        <div className="form-row"><label>Τύπος</label>
          <select value={form.kind} onChange={e => setForm({...form, kind:e.target.value})}>
            <option value="shift">Βάρδιες (ανάλογα με το πρόγραμμα)</option><option value="fixed">Σταθερό ωράριο</option>
          </select>
        </div>
        {form.kind === 'fixed' && (<>
          <div className="form-row"><label>Ωράριο</label><input placeholder="07:00-15:00" value={form.fixed_time} onChange={e => setForm({...form, fixed_time:e.target.value})}/></div>
          <div className="form-row"><label>Μέρες</label><div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
            {[1,2,3,4,5,6,7].map(d => <label key={d} style={{display:'flex', gap:4, alignItems:'center'}}><input type="checkbox" checked={form.fixed_days.includes(d)} onChange={e => setForm({...form, fixed_days: e.target.checked ? [...form.fixed_days, d].sort() : form.fixed_days.filter(x => x !== d)})}/>{ISO_SHORT[d]}</label>)}
          </div></div>
        </>)}
        <div className="form-row"><label>{t('hourlyRate')} (€)</label><input type="number" step="0.01" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>{t('save')}</button></div>
      </div>
    </div>
  )
}

function Payroll({ employees, month, setMonth }) {
  const { t } = useLanguage()
  const [cells, setCells] = useState({})
  useEffect(() => { supabase.from('sched_months').select('cells').eq('ym', month).maybeSingle().then(({ data }) => setCells(data?.cells || {})) }, [month])
  const rows = employees.map(e => {
    const cs = Object.values(cells[e.id] || {})
    const hoursWorked = cs.filter(c => c.k === 'w').reduce((sum, c) => sum + (span(c.t)?.d || 0) / 60, 0)
    const leaveDays = cs.filter(c => c.k === 'a').length
    const dayoffDays = cs.filter(c => c.k === 'r').length
    const pay = hoursWorked * Number(e.hourly_rate || 0)
    return { ...e, hoursWorked, leaveDays, dayoffDays, pay }
  })
  const totalPay = rows.reduce((s, r) => s + r.pay, 0)

  async function exportCSV() {
    const r2 = (n) => Math.round(n * 100) / 100
    const pr = [[t('employees'), t('store'), t('role'), t('hoursWorkedLabel'), t('leaveDaysLabel'), t('dayoffDaysLabel'), t('hourlyRate'), t('grossPayLabel')]]
    rows.forEach(r => pr.push([r.name, r.stores?.name || '', r.role, r2(r.hoursWorked), r.leaveDays, r.dayoffDays, Number(r.hourly_rate || 0), r2(r.pay)]))
    pr.push(['', '', '', '', '', '', t('total'), r2(totalPay)])
    await exportXlsx(`payroll-${month}`, [{ name: t('payroll'), rows: pr }])
  }

  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
        <h2 style={{margin:0}}>{t('payroll')} — {month}</h2>
        <div style={{display:'flex', gap:8}}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn export-btn" onClick={exportCSV}><Download size={16}/> {t('exportExcel')}</button>
        </div>
      </div>
      <table>
        <thead><tr><th>{t('employees')}</th><th>{t('store')}</th><th>{t('hours')}</th><th>{t('leave')}</th><th>{t('dayoff')}</th><th>{t('hourlyRate')}</th><th>{t('grossPayLabel')}</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{r.stores?.name}</td>
              <td>{r.hoursWorked.toFixed(1)}</td><td>{r.leaveDays}</td><td>{r.dayoffDays}</td>
              <td>{Number(r.hourly_rate).toFixed(2)} €</td>
              <td><b>{r.pay.toFixed(2)} €</b></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7}>{t('noEmployees')}</td></tr>}
        </tbody>
      </table>
      <div style={{marginTop:16}}>
        <div className="stat-label">{t('payrollTotal')}</div>
        <div className="stat-value">{totalPay.toFixed(2)} €</div>
      </div>
    </div>
  )
}
