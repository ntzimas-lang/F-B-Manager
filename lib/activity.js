import { supabase } from './supabase'

/**
 * Καταγράφει μια ενέργεια χρήστη στο activity_log.
 * action: 'create' | 'update' | 'delete'
 * entityType: π.χ. 'store', 'recipe', 'ingredient', 'order', 'shift', ...
 * entityName: αναγνωρίσιμο όνομα της εγγραφής (π.χ. όνομα πιάτου)
 * details: προαιρετική επιπλέον περιγραφή
 */
export async function logActivity(action, entityType, entityName, details = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_log').insert({
      user_id: user?.id || null,
      user_email: user?.email || null,
      action,
      entity_type: entityType,
      entity_name: entityName,
      details,
    })
  } catch (e) {
    console.error('Αποτυχία καταγραφής δραστηριότητας:', e)
  }
}
