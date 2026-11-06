import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { logActivity } from './activity'

// Δημιουργεί χρήστη (email + κωδικός) και τον δένει στην εταιρεία, ρόλο και (αν χρειάζεται) κατάστημα.
export async function createUser({ email, password, role, storeId, companyId }) {
  const temp = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tmp-signup' },
  })
  const { data, error } = await temp.auth.signUp({ email, password })
  if (error || !data.user) return { error: error?.message || 'Error' }
  let err = null
  for (let i = 0; i < 5; i++) {
    const r = await supabase.rpc('claim_user', { p_user: data.user.id, p_role: role, p_store: storeId || null, p_company: companyId || null })
    err = r.error
    if (!err) break
    await new Promise(res => setTimeout(res, 600))
  }
  if (err) return { error: err.message }
  await logActivity('create', 'user', email, role)
  return {}
}

export async function removeUser(u) {
  const { error } = await supabase.rpc('delete_user', { p_user: u.id })
  if (error) return { error: error.message }
  await logActivity('delete', 'user', u.email)
  return {}
}
