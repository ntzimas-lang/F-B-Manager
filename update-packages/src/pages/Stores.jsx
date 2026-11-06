import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useStores } from '../context/StoreContext'
import CompanyPanel, { StoreFormModal } from './CompanyPanel'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

// Ρυθμίσεις εταιρίας: ιδιοκτήτης/λογιστήριο και ανά κατάστημα οι χρήστες.
export default function Stores() {
  const { t } = useLanguage()
  const { role, profile, maxStores } = useAuth()
  const { stores } = useStores()
  const [edit, setEdit] = useState(null)
  const isAdminRole = role === 'super_user' || role === 'owner'

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}><h1>{t('settings')}</h1></div>
      {isAdminRole && profile?.company_id
        ? <CompanyPanel companyId={profile.company_id} maxStores={maxStores} onChanged={() => window.location.reload()} />
        : stores.filter(s => s.id === profile?.store_id).map(s => (
          <div className="card" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>{s.name} <span style={{ fontWeight: 400, fontSize: 13 }}>{[s.code, s.address].filter(Boolean).join(' · ')}</span></b>
            <button className="icon-btn" onClick={() => setEdit(s)}><Pencil size={16} /></button>
          </div>
        ))}
      {edit && <StoreFormModal store={edit} onClose={() => setEdit(null)} onSaved={() => window.location.reload()} />}
    </div>
  )
}
