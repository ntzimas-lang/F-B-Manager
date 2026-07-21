import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './context/StoreContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Stores from './pages/Stores'
import Recipes from './pages/Recipes'
import Costing from './pages/Costing'
import Inventory from './pages/Inventory'
import Stocktake from './pages/Stocktake'
import Orders from './pages/Orders'
import Staff from './pages/Staff'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/costing" element={<Costing />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/stocktake" element={<Stocktake />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/staff" element={<Staff />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
