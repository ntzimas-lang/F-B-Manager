import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { PLANS, PLAN_FEATURES, TOGGLEABLE } from '../lib/plans'
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
  const [uEmail, setUEmail] = useState('')
  const [uPass, setUPass] = useState('')
  const [uCompany, setUCompany] = useState('')
  const [uMsg, setUMsg] = useState('')

  async function addUser() {
    setUMsg('')
    if (!uEmail || uPass.length < 6 || !uCompany) { setUMsg(t('userFormHint')); return }
    const temp = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tmp-signup' },
    })
    const { data, error } = await temp.auth.signUp({ email: uEmail, password: uPass })
    if (error || !data.user) { setUMsg(error?.message || 'Error'); return }
    // το profile δημιουργείται αυτόματα· το συνδέουμε με την εταιρεία
    let ok = false
    for (let i = 0; i < 5 && !ok; i++) {
      const { data: upd } = await supabase.from('profiles').update({ company_id: uCompany, role: 'owner' }).eq('id', data.user.id).select()
      ok = !!upd?.length
      if (!ok) await new Promise(r => setTimeout(r, 500))
    }
    setUMsg(ok ? t('userCreated') : 'Error')
    if (ok) { setUEmail(''); setUPass('') }
    load()
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
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>{t('newCustomerUser')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Email" value={uEmail} onChange={e => setUEmail(e.target.value)} />
          <input placeholder={t('password')} value={uPass} onChange={e => setUPass(e.target.value)} />
          <select value={uCompany} onChange={e => setUCompany(e.target.value)}>
            <option value="">{t('company')}...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn" onClick={addUser}><Plus size={16} /> {t('add')}</button>
        </div>
        {uMsg && <p style={{ marginBottom: 0 }}>{uMsg}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>{t('company')}</th><th>{t('plan')}</th><th>{t('usersCount')}</th><th>{t('storeLimit')}</th><th></th></tr></thead>
          <tbody>
            {companies.map(c => (
              <Fragment key={c.id}>
              <tr>
                <td><input defaultValue={c.name} onBlur={e => e.target.value !== c.name && update(c.id, { name: e.target.value })} /></td>
                <td>
                  <select value={c.plan} onChange={e => update(c.id, 'features' in c ? { plan: e.target.value, features: null } : { plan: e.target.value })}>
                    {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                  </select>
                </td>
                <td>{profiles.filter(p => p.company_id === c.id).length}</td>
                <td>{'max_stores' in c && <input type="number" min="0" style={{ width: 70 }} defaultValue={c.max_stores} onBlur={e => Number(e.target.value) !== c.max_stores && update(c.id, { max_stores: Number(e.target.value) })} />}</td>
                <td>{'features' in c && <button className="btn btn-outline" onClick={() => setOpenId(openId === c.id ? null : c.id)}>{t('customizeModules')}{Array.isArray(c.features) ? ' *' : ''}</button>}</td>
              </tr>
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
