import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ChefHat, Calculator, Boxes, Truck, Store, ClipboardCheck, Users } from 'lucide-react'
import { useStores } from '../context/StoreContext'

export default function Layout() {
  const { stores, selectedStoreId, selectStore, loading } = useStores()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">F&B <span>Manager</span></div>
        <NavLink to="/" end className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <LayoutDashboard size={18} /> Πίνακας Ελέγχου
        </NavLink>
        <NavLink to="/stores" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Store size={18} /> Καταστήματα
        </NavLink>
        <NavLink to="/recipes" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <ChefHat size={18} /> Μενού & Συνταγές
        </NavLink>
        <NavLink to="/costing" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Calculator size={18} /> Food Costing
        </NavLink>
        <NavLink to="/inventory" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Boxes size={18} /> Απόθεμα
        </NavLink>
        <NavLink to="/stocktake" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <ClipboardCheck size={18} /> Απογραφή
        </NavLink>
        <NavLink to="/orders" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Truck size={18} /> Παραγγελίες
        </NavLink>
        <NavLink to="/staff" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
          <Users size={18} /> Προσωπικό & Βάρδιες
        </NavLink>
      </aside>
      <main className="main-content">
        <div className="topbar">
          <div />
          {!loading && (
            <select
              className="store-select"
              value={selectedStoreId}
              onChange={(e) => selectStore(e.target.value)}
            >
              <option value="all">Όλα τα καταστήματα</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
        <Outlet />
      </main>
    </div>
  )
}
