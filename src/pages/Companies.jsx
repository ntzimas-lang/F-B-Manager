import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { PLANS } from '../lib/plans'
import { Plus } from 'lucide-react'

const PLAN_LABEL = { basic: 'Basic', pro: 'Pro', premium: 'Premium' }

export default function Companies() {
  const { isPlatformAdmin } = useAuth()
  const { t } = useLanguage()
  const [companies, setCompanies] = useState([])
  const [profiles, setProfiles] = useState([])
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('basic')

  async function load() {
    const [c, p] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('profiles').select('id, company_id'),
    ])
    setCompanies(c.data || [])
    setProfiles(p.data || [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!name.trim()) return
    await supabase.from('companies').insert({ name: name.trim(), plan })
    setName(''); setPlan('basic'); load()
  }
  async function update(id, patch) {
    await supabase.from('companies').update(patch).eq('id', id)
    load()
  }

  if (!isPlatformAdmin) return <div className="card">{t('superUserOnly')}</div>

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}><h1>{t('companies')}</h1></div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder={t('name')} value={name} onChange={e => setName(e.target.value)} />
        <select value={plan} onChange={e => setPlan(e.target.value)}>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
        </select>
        <button className="btn" onClick={add}><Plus size={16} /> {t('newCompany')}</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>{t('company')}</th><th>{t('plan')}</th><th>{t('usersCount')}</th></tr></thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id}>
                <td><input defaultValue={c.name} onBlur={e => e.target.value !== c.name && update(c.id, { name: e.target.value })} /></td>
                <td>
                  <select value={c.plan} onChange={e => update(c.id, { plan: e.target.value })}>
                    {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                  </select>
                </td>
                <td>{profiles.filter(p => p.company_id === c.id).length}</td>
              </tr>
            ))}
            {companies.length === 0 && <tr><td colSpan={3}>{t('noCompanies')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
