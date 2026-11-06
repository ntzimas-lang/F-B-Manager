import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { StoreProvider } from './context/StoreContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stores from './pages/Stores'
import Recipes from './pages/Recipes'
import Ingredients from './pages/Ingredients'
import Costing from './pages/Costing'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Stocktake from './pages/Stocktake'
import Receiving from './pages/Receiving'
import Orders from './pages/Orders'
import Staff from './pages/Staff'
import ActivityLog from './pages/ActivityLog'
import Companies from './pages/Companies'
import SetPassword from './pages/SetPassword'
import Admin from './pages/Admin'
import Reports from './pages/Reports'
import MyBusiness, { EmbeddedApp, AppShell } from './pages/MyBusiness'
import Deliveries from './pages/Deliveries'
import DeliveryPublic from './pages/DeliveryPublic'
import MenuFC from './pages/MenuFC'

function Feature({ name, children }) {
  const { hasFeature } = useAuth()
  const { t } = useLanguage()
  if (!hasFeature(name)) return <div className="card">{t('notInPlan')}</div>
  return children
}

function Gate() {
  const { session, loading, profile, isPlatformAdmin, signOut, recovery } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Φόρτωση...</div>
  }
  if (!session) {
    return <Login />
  }
  if (recovery) {
    return <SetPassword />
  }

  if (profile && 'company_id' in profile && !profile.company_id && !isPlatformAdmin) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 480 }}>
        <p>{t('noCompany')}</p>
        <button className="btn" onClick={signOut}>{t('logout')}</button>
      </div>
    )
  }

  if (profile?.companies?.active === false && !isPlatformAdmin) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 480 }}>
        <p>{t('accountDisabled')}</p>
        <button className="btn" onClick={signOut}>{t('logout')}</button>
      </div>
    )
  }

  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MyBusiness />} />
          <Route path="/app/:id" element={<EmbeddedApp />} />
          <Route path="/menu-fc" element={<MenuFC />} />
          <Route path="/deltia" element={<AppShell title="Δελτία Εκδηλώσεων"><Deliveries /></AppShell>} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stores" element={<Feature name="stores"><Stores /></Feature>} />
            <Route path="/recipes" element={<Feature name="recipes"><Recipes /></Feature>} />
            <Route path="/ingredients" element={<Feature name="ingredients"><Ingredients /></Feature>} />
            <Route path="/costing" element={<Feature name="costing"><Costing /></Feature>} />
            <Route path="/inventory" element={<Feature name="inventory"><Inventory /></Feature>} />
            <Route path="/sales" element={<Feature name="sales"><Sales /></Feature>} />
            <Route path="/stocktake" element={<Feature name="stocktake"><Stocktake /></Feature>} />
            <Route path="/receiving" element={<Feature name="receiving"><Receiving /></Feature>} />
            <Route path="/orders" element={<Feature name="orders"><Orders /></Feature>} />
            <Route path="/staff" element={<Feature name="staff"><Staff /></Feature>} />
            <Route path="/activity" element={<Feature name="activity"><ActivityLog /></Feature>} />
            <Route path="/reports" element={<Feature name="reports"><Reports /></Feature>} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/users" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}

export default function App() {
  const m = window.location.pathname.match(/^\/d\/([0-9a-f-]{36})$/i)
  if (m) return <DeliveryPublic token={m[1]} />
  if (window.location.pathname === '/menu-fc') return <BrowserRouter><MenuFC /></BrowserRouter>
  return (
    <LanguageProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </LanguageProvider>
  )
}
