import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Navigate } from 'react-router-dom'
import Stores from './Stores'

export default function Admin() {
  const { hasFeature, isPlatformAdmin, role } = useAuth()
  const { t } = useLanguage()
  const allowed = isPlatformAdmin || (hasFeature('stores') && ['super_user', 'owner', 'store_manager'].includes(role))
  if (isPlatformAdmin) return <Navigate to="/companies" replace />
  if (!allowed) return <div className="card">{t('notInPlan')}</div>
  return <Stores />
}
