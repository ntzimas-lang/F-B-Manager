import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ChefHat, Calculator, Boxes, Truck, Store, ClipboardCheck, Users, Wheat, History, LogOut, Menu, Receipt, UserCog, PackageCheck, Settings } from 'lucide-react'
import { useStores } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Layout() {
  const { stores, selectedStoreId, selectStore, loading } = useStores()
  const { profile, session, signOut, hasFeature, isPlatformAdmin } = useAuth()
  const { lang, chooseLang, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className={'sidebar-backdrop' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)} />
      <aside className={'sidebar' + (menuOpen ? ' open' : '')} onClick={(e) => { if (e.target.closest('a')) setMenuOpen(false) }}>
        <div className="sidebar-logo">F&B <span>Manager</span></div>
        {hasFeature('dashboard') && (
          <NavLink to="/" end className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <LayoutDashboard size={18} /> {t('dashboard')}
          </NavLink>
        )}
        {(hasFeature('orders') || hasFeature('receiving') || hasFeature('sales') || hasFeature('inventory') || hasFeature('stocktake')) && <div className="nav-group-label">{lang === 'el' ? 'Καθημερινά' : 'Daily'}</div>}
        {hasFeature('orders') && (
          <NavLink to="/orders" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <Truck size={18} /> {t('orders')}
          </NavLink>
        )}
        {hasFeature('receiving') && (
          <NavLink to="/receiving" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <PackageCheck size={18} /> {t('receiving')}
          </NavLink>
        )}
        {hasFeature('sales') && (
          <NavLink to="/sales" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <Receipt size={18} /> {t('sales')}
          </NavLink>
        )}
        {hasFeature('inventory') && (
          <NavLink to="/inventory" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <Boxes size={18} /> {t('inventory')}
          </NavLink>
        )}
        {hasFeature('stocktake') && (
          <NavLink to="/stocktake" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <ClipboardCheck size={18} /> {t('stocktake')}
          </NavLink>
        )}
        {(hasFeature('ingredients') || hasFeature('recipes') || hasFeature('costing')) && <div className="nav-group-label">{lang === 'el' ? 'Μενού & Κόστος' : 'Menu & Costs'}</div>}
        {hasFeature('ingredients') && (
          <NavLink to="/ingredients" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <Wheat size={18} /> {t('ingredients')}
          </NavLink>
        )}
        {hasFeature('recipes') && (
          <NavLink to="/recipes" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <ChefHat size={18} /> {t('recipes')}
          </NavLink>
        )}
        {hasFeature('costing') && (
          <NavLink to="/costing" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <Calculator size={18} /> {t('costing')}
          </NavLink>
        )}
        {true && <div className="nav-group-label">{lang === 'el' ? 'Διαχείριση' : 'Management'}</div>}
        {hasFeature('staff') && (
          <NavLink to="/staff" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <Users size={18} /> {t('staff')}
          </NavLink>
        )}
        {hasFeature('activity') && (
          <NavLink to="/activity" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <History size={18} /> {t('activity')}
          </NavLink>
        )}
        <NavLink to="/admin" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Settings size={18} /> {t('settings')}
        </NavLink>

        <div style={{ padding: '16px 20px 4px' }}>
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => chooseLang('el')}
              style={{
                flex: 1, padding: '7px 10px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: lang === 'el' ? 'var(--olive-500)' : 'transparent', color: '#fff',
              }}
            >Ελληνικά</button>
            <button
              onClick={() => chooseLang('en')}
              style={{
                flex: 1, padding: '7px 10px', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: lang === 'en' ? 'var(--olive-500)' : 'transparent', color: '#fff',
              }}
            >English</button>
          </div>
        </div>

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
          <button className="menu-btn" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
