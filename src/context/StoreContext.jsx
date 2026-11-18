import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const { profile, isStoreScoped } = useAuth()
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState(
    localStorage.getItem('fb_selected_store') || 'all'
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStores() {
      let q = supabase.from('stores').select('*').eq('active', true).order('name')
      if (profile?.company_id) q = q.eq('company_id', profile.company_id)
      const { data, error } = await q
      if (!error && data) setStores(data)
      setLoading(false)
    }
    loadStores()
  }, [profile?.company_id])

  useEffect(() => {
    if (isStoreScoped && profile?.store_id) {
      setSelectedStoreId(profile.store_id)
      localStorage.setItem('fb_selected_store', profile.store_id)
    }
  }, [isStoreScoped, profile?.store_id])

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
