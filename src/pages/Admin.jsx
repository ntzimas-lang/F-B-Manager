import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Stores from './Stores'

export default function Admin() {
  const { hasFeature, isPlatformAdmin, role } = useAuth()
  const { t } = useLanguage()
  const allowed = isPlatformAdmin || (hasFeature('stores') && ['super_user', 'owner', 'store_manager'].includes(role))
  if (!allowed) return <div className="card">{t('notInPlan')}</div>
  return <Stores />
}
