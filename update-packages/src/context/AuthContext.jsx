import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLAN_FEATURES, ROLE_MODULES } from '../lib/plans'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) { setProfile(null); return }
      let { data, error } = await supabase.from('profiles').select('*, companies(name, plan, features, max_stores, active)').eq('id', session.user.id).maybeSingle()
      if (error) {
        const r = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        data = r.data
      }
      setProfile(data)
    }
    loadProfile()
  }, [session])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }
  async function signUp(email, password) {
    return supabase.auth.signUp({ email, password })
  }
  async function signOut() {
    await supabase.auth.signOut()
  }

  const plan = profile?.companies?.plan || 'premium'
  const isPlatformAdmin = !!profile?.is_platform_admin
  const maxStores = profile?.companies?.max_stores ?? 9999
  const custom = profile?.companies?.features
  const role = profile?.role
  const planAllows = (f) => (Array.isArray(custom) ? [...custom, 'dashboard', 'stores', 'users'] : (PLAN_FEATURES[plan] || PLAN_FEATURES.premium)).includes(f)
  const roleAllows = (f) => { const m = ROLE_MODULES[role]; return !m || m.includes(f) }
  const hasFeature = (f) => planAllows(f) && roleAllows(f)
  const readOnly = role === 'accounting'
  const hideCosts = role === 'shift_manager'
  const canExport = role !== 'shift_manager'
  const isStoreScoped = role === 'store_manager' || role === 'shift_manager'

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, recovery, setRecovery, maxStores, plan, isPlatformAdmin, hasFeature, role, readOnly, hideCosts, canExport, isStoreScoped }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
