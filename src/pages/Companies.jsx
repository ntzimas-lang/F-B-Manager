import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { PLANS, PLAN_FEATURES, TOGGLEABLE } from '../lib/plans'
import { Plus, Trash2 } from 'lucide-react'
import CompanyPanel, { AddPerson } from './CompanyPanel'
import { removeUser } from '../lib/userAdmin'

const PLAN_LABEL = { basic: 'Basic', pro: 'Pro', premium: 'Premium' }

export default function Companies() {
  const { isPlatformAdmin, profile } = useAuth()
  const [addSuper, setAddSuper] = useState(false)
  const [panelId, setPanelId] = useState(null)
  const { t } = useLanguage()
  const [companies, setCompanies] = useState([])
  const [profiles, setProfiles] = useState([])
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('basic')

  async function load() {
    const [c, p] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('profiles').select('id, email, role, company_id, is_platform_admin'),
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
  const [openId, setOpenId] = useState(null)
  function effective(c) {
    return Array.isArray(c.features) ? c.features : PLAN_FEATURES[c.plan]
  }
  function toggle(c, f) {
    const cur = effective(c)
    const next = cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f]
    update(c.id, { features: next })
  }

  async function removeCompany(c) {
    const typed = prompt(`${t('deleteCompanyWarn')}\n\n${t('typeNameToConfirm')}: ${c.name}`)
    if (typed === null) return
    if (typed.trim() !== c.name) { alert(t('nameMismatch')); return }
    const { error } = await supabase.rpc('delete_company', { p_company: c.id })
    if (error) alert(error.message)
    load()
  }

  async function update(id, patch) {
    await supabase.from('companies').update(patch).eq('id', id)
    load()
  }

  const admins = profiles.filter(p => p.is_platform_admin)

  if (!isPlatformAdmin) return <div className="card">{t('superUserOnly')}</div>

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}><h1>{t('settings')}</h1></div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder={t('name')} value={name} onChange={e => setName(e.target.value)} />
        <select value={plan} onChange={e => setPlan(e.target.value)}>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
        </select>
        <button className="btn" onClick={add}><Plus size={16} /> {t('newCompany')}</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t('superUsers')}</h2>
          {!addSuper && <button className="btn" onClick={() => setAddSuper(true)}><Plus size={16} /> {t('addPerson')}</button>}
        </div>
        {addSuper && <AddPerson companyId={profile?.company_id} roles={['platform_admin']} ROLE={{ platform_admin: t('superUser') }} onClose={() => setAddSuper(false)} onDone={() => { setAddSuper(false); load() }} />}
        <table><tbody>
          {admins.map(u => (
            <tr key={u.id}><td>{u.email}</td><td>{t('superUser')}</td>
              <td style={{ width: 40 }}>{u.id !== profile?.id && <button className="icon-btn danger" onClick={async () => { if (confirm(`${t('confirmDelete')} ${u.email}`)) { const r = await removeUser(u); if (r.error) alert(r.error); load() } }}><Trash2 size={16} /></button>}</td></tr>
          ))}
        </tbody></table>
      </div>
      <h2 style={{ margin: '8px 0' }}>{t('companies')}</h2>
      <div className="card">
        <table>
          <thead><tr><th>{t('company')}</th><th>{t('plan')}</th><th>{t('usersCount')}</th><th>{t('storeLimit')}</th><th></th></tr></thead>
          <tbody>
            {companies.map(c => (
              <Fragment key={c.id}>
              <tr>
                <td style={c.active === false ? { opacity: 0.55 } : undefined}><input defaultValue={c.name} onBlur={e => e.target.value !== c.name && update(c.id, { name: e.target.value })} /></td>
                <td>
                  <select value={c.plan} onChange={e => update(c.id, 'features' in c ? { plan: e.target.value, features: null } : { plan: e.target.value })}>
                    {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                  </select>
                </td>
                <td>{profiles.filter(p => p.company_id === c.id).length}{c.active === false && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--danger)' }}>{t('inactive')}</span>}</td>
                <td>{'max_stores' in c && <input type="number" min="0" style={{ width: 70 }} defaultValue={c.max_stores} onBlur={e => Number(e.target.value) !== c.max_stores && update(c.id, { max_stores: Number(e.target.value) })} />}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={() => setPanelId(panelId === c.id ? null : c.id)}>{t('manage')}</button> {'active' in c && <button className="btn btn-outline" onClick={() => update(c.id, { active: c.active === false })}>{c.active === false ? t('activate') : t('deactivate')}</button>} {'features' in c && <button className="btn btn-outline" onClick={() => setOpenId(openId === c.id ? null : c.id)}>{t('customizeModules')}{Array.isArray(c.features) ? ' *' : ''}</button>} {c.id !== profile?.company_id && <button className="icon-btn danger" onClick={() => removeCompany(c)}><Trash2 size={16} /></button>}</td>
              </tr>
              {panelId === c.id && (
                <tr><td colSpan={5} style={{ background: 'var(--olive-50, #f4f5ec)' }}><CompanyPanel companyId={c.id} maxStores={c.max_stores ?? 9999} onChanged={load} /></td></tr>
              )}
              {openId === c.id && (
                <tr>
                  <td colSpan={5}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10 }}>
                      {TOGGLEABLE.map(f => (
                        <label key={f} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="checkbox" checked={effective(c).includes(f)} onChange={() => toggle(c, f)} /> {t(f)}
                        </label>
                      ))}
                    </div>
                    {Array.isArray(c.features) && <button className="btn btn-outline" onClick={() => update(c.id, { features: null })}>{t('resetToPlan')}</button>}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {companies.length === 0 && <tr><td colSpan={5}>{t('noCompanies')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
