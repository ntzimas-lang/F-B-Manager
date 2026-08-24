import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ChefHat, Calculator, Boxes, Truck, Store, ClipboardCheck, Users, Wheat, History, LogOut, Receipt, UserCog, Globe } from 'lucide-react'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Layout() {
  const { stores, selectedStoreId, selectStore, loading } = useStores()
  const { profile, session, signOut } = useAuth()
  const { lang, toggleLang, t } = useLanguage()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">F&B <span>Manager</span></div>
        <NavLink to="/" end className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <LayoutDashboard size={18} /> {t('dashboard')}
        </NavLink>
        <NavLink to="/stores" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Store size={18} /> {t('stores')}
        </NavLink>

        <div className="nav-group-label">{lang === 'el' ? 'Μενού' : 'Menu'}</div>
        <NavLink to="/recipes" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <ChefHat size={18} /> {t('recipes')}
        </NavLink>
        <NavLink to="/costing" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Calculator size={18} /> {t('costing')}
        </NavLink>

        <div className="nav-group-label">{lang === 'el' ? 'Λειτουργία' : 'Operations'}</div>
        <NavLink to="/ingredients" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Wheat size={18} /> {t('ingredients')}
        </NavLink>
        <NavLink to="/inventory" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Boxes size={18} /> {t('inventory')}
        </NavLink>
        <NavLink to="/sales" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Receipt size={18} /> {t('sales')}
        </NavLink>
        <NavLink to="/stocktake" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <ClipboardCheck size={18} /> {t('stocktake')}
        </NavLink>
        <NavLink to="/orders" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Truck size={18} /> {t('orders')}
        </NavLink>

        <NavLink to="/staff" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Users size={18} /> {t('staff')}
        </NavLink>
        <NavLink to="/activity" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <History size={18} /> {t('activity')}
        </NavLink>
        {profile?.role === 'super_user' && (
          <NavLink to="/users" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <UserCog size={18} /> {t('users')}
          </NavLink>
        )}

        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, wordBreak: 'break-all' }}>
            {profile?.display_name || session?.user?.email}
          </div>
          <button
            onClick={signOut}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13, padding: 0 }}
          >
            <LogOut size={14} /> {t('logout')}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="topbar">
          <div />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={toggleLang}
              title={lang === 'el' ? 'Switch to English' : 'Αλλαγή σε Ελληνικά'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6,
                border: '1px solid #d8dcc9', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              <Globe size={15} /> {lang === 'el' ? 'ΕΛ' : 'EN'}
            </button>
            {!loading && (
              <select
                className="store-select"
                value={selectedStoreId}
                onChange={(e) => selectStore(e.target.value)}
              >
                <option value="all">{t('allStores')}</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
