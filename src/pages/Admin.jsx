import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Stores from './Stores'
import Users from './Users'
import Companies from './Companies'

export default function Admin() {
  const { hasFeature, isPlatformAdmin, profile } = useAuth()
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()

  const tabs = [
    (hasFeature('stores') && ['super_user', 'owner', 'store_manager'].includes(profile?.role) || isPlatformAdmin) && { key: 'stores', label: t('stores'), el: <Stores /> },
    (['super_user', 'owner'].includes(profile?.role) || isPlatformAdmin) && { key: 'users', label: t('users'), el: <Users /> },
    isPlatformAdmin && { key: 'companies', label: t('companies'), el: <Companies /> },
  ].filter(Boolean)

  const active = tabs.find(x => x.key === params.get('tab')) || tabs[0]
  if (!active) return <div className="card">{t('notInPlan')}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--olive-100)', flexWrap: 'wrap' }}>
        {tabs.map(x => (
          <button
            key={x.key}
            onClick={() => setParams({ tab: x.key })}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15,
              fontWeight: active.key === x.key ? 700 : 500,
              color: active.key === x.key ? 'var(--olive-900)' : '#6b6b5f',
              borderBottom: active.key === x.key ? '3px solid var(--olive-600)' : '3px solid transparent',
              marginBottom: -1,
            }}
          >{x.label}</button>
        ))}
      </div>
      {active.el}
    </div>
  )
}
