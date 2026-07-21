import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { StoreProvider } from './context/StoreContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stores from './pages/Stores'
import Recipes from './pages/Recipes'
import Ingredients from './pages/Ingredients'
import Costing from './pages/Costing'
import Inventory from './pages/Inventory'
import Stocktake from './pages/Stocktake'
import Orders from './pages/Orders'
import Staff from './pages/Staff'
import ActivityLog from './pages/ActivityLog'

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Φόρτωση...</div>
  }
  if (!session) {
    return <Login />
  }

  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/costing" element={<Costing />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/stocktake" element={<Stocktake />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/activity" element={<ActivityLog />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
