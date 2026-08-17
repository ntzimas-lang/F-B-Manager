import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState(
    localStorage.getItem('fb_selected_store') || 'all'
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStores() {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name')
      if (!error && data) setStores(data)
      setLoading(false)
    }
    loadStores()
  }, [])

  function selectStore(id) {
    setSelectedStoreId(id)
    localStorage.setItem('fb_selected_store', id)
  }

  return (
    <StoreContext.Provider value={{ stores, selectedStoreId, selectStore, loading }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStores() {
  return useContext(StoreContext)
}
