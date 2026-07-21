import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, X } from 'lucide-react'

export default function Recipes() {
  const [tab, setTab] = useState('recipes')
  const [recipes, setRecipes] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [openRecipe, setOpenRecipe] = useState(null) // recipe being edited (ingredient linking)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [showIngredientForm, setShowIngredientForm] = useState(false)

  async function loadAll() {
    const [r, i, s] = await Promise.all([
      supabase.from('recipes').select('*').order('name'),
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setRecipes(r.data || [])
    setIngredients(i.data || [])
    setSuppliers(s.data || [])
  }

  useEffect(() => { loadAll() }, [])

  async function deleteRecipe(id) {
    if (!confirm('Διαγραφή συνταγής;')) return
    await supabase.from('recipes').delete().eq('id', id)
    loadAll()
  }
  async function deleteIngredient(id) {
    if (!confirm('Διαγραφή πρώτης ύλης;')) return
    await supabase.from('ingredients').delete().eq('id', id)
    loadAll()
  }

  return (
    <div>
      <div className="topbar" style={{marginBottom: 16}}>
        <h1>Μενού & Συνταγές</h1>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:20}}>
        <button className={tab==='recipes' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('recipes')}>Πιάτα Μενού</button>
        <button className={tab==='ingredients' ? 'btn' : 'btn btn-outline'} onClick={() => setTab('ingredients')}>Πρώτες Ύλες</button>
      </div>

      {tab === 'recipes' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2>Πιάτα ({recipes.length})</h2>
            <button className="btn" onClick={() => setShowRecipeForm(true)}><Plus size={16}/> Νέο Πιάτο</button>
          </div>
          <table>
            <thead><tr><th>Όνομα</th><th>Κατηγορία</th><th>Τιμή Πώλησης</th><th>Μερίδα</th><th></th></tr></thead>
            <tbody>
              {recipes.map(r => (
                <tr key={r.id} style={{cursor:'pointer'}} onClick={() => setOpenRecipe(r)}>
                  <td>{r.name}</td>
                  <td>{r.category}</td>
                  <td>{Number(r.selling_price).toFixed(2)} €</td>
                  <td>{r.portion_size}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="icon-btn danger" onClick={() => deleteRecipe(r.id)}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {recipes.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν πιάτα ακόμα.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ingredients' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
            <h2>Πρώτες Ύλες ({ingredients.length})</h2>
            <button className="btn" onClick={() => setShowIngredientForm(true)}><Plus size={16}/> Νέα Πρώτη Ύλη</button>
          </div>
          <table>
            <thead><tr><th>Όνομα</th><th>Μονάδα</th><th>Τιμή</th><th>Προμηθευτής</th><th></th></tr></thead>
            <tbody>
              {ingredients.map(ing => (
                <tr key={ing.id}>
                  <td>{ing.name}</td>
                  <td>{ing.unit}</td>
                  <td>{Number(ing.current_price).toFixed(3)} €</td>
                  <td>{suppliers.find(s => s.id === ing.supplier_id)?.name || '-'}</td>
                  <td><button className="icon-btn danger" onClick={() => deleteIngredient(ing.id)}><Trash2 size={16}/></button></td>
                </tr>
              ))}
              {ingredients.length === 0 && <tr><td colSpan={5}>Δεν υπάρχουν πρώτες ύλες ακόμα.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showRecipeForm && (
        <RecipeFormModal suppliers={suppliers} onClose={() => setShowRecipeForm(false)} onSaved={() => { setShowRecipeForm(false); loadAll() }} />
      )}
      {showIngredientForm && (
        <IngredientFormModal suppliers={suppliers} onClose={() => setShowIngredientForm(false)} onSaved={() => { setShowIngredientForm(false); loadAll() }} />
      )}
      {openRecipe && (
        <RecipeIngredientsModal recipe={openRecipe} allIngredients={ingredients} onClose={() => setOpenRecipe(null)} />
      )}
    </div>
  )
}

function RecipeFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', category:'', selling_price:'', portion_size:'' })
  async function save() {
    if (!form.name) return
    await supabase.from('recipes').insert({ ...form, selling_price: Number(form.selling_price) || 0 })
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέο Πιάτο</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Όνομα</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>Κατηγορία</label><input value={form.category} onChange={e => setForm({...form, category:e.target.value})} placeholder="π.χ. Κυρίως Πιάτο"/></div>
        <div className="form-row"><label>Τιμή Πώλησης (€)</label><input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({...form, selling_price:e.target.value})}/></div>
        <div className="form-row"><label>Μερίδα</label><input value={form.portion_size} onChange={e => setForm({...form, portion_size:e.target.value})} placeholder="π.χ. 300gr"/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}

function IngredientFormModal({ suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', unit:'kg', current_price:'', supplier_id:'', min_stock_alert:'' })
  async function save() {
    if (!form.name) return
    await supabase.from('ingredients').insert({
      ...form,
      current_price: Number(form.current_price) || 0,
      min_stock_alert: Number(form.min_stock_alert) || 0,
      supplier_id: form.supplier_id || null,
    })
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>Νέα Πρώτη Ύλη</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
        <div className="form-row"><label>Όνομα</label><input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></div>
        <div className="form-row"><label>Μονάδα</label>
          <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})}>
            <option value="kg">kg</option><option value="gr">gr</option><option value="lt">lt</option>
            <option value="ml">ml</option><option value="τεμ">τεμ</option>
          </select>
        </div>
        <div className="form-row"><label>Τιμή ανά μονάδα (€)</label><input type="number" step="0.001" value={form.current_price} onChange={e => setForm({...form, current_price:e.target.value})}/></div>
        <div className="form-row"><label>Προμηθευτής</label>
          <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
            <option value="">-</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row"><label>Όριο Ειδοποίησης Αποθέματος</label><input type="number" step="0.1" value={form.min_stock_alert} onChange={e => setForm({...form, min_stock_alert:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn" onClick={save}>Αποθήκευση</button></div>
      </div>
    </div>
  )
}

function RecipeIngredientsModal({ recipe, allIngredients, onClose }) {
  const [links, setLinks] = useState([])
  const [addIngId, setAddIngId] = useState('')
  const [addQty, setAddQty] = useState('')

  async function load() {
    const { data } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipe.id)
    setLinks(data || [])
  }
  useEffect(() => { load() }, [])

  async function addLink() {
    if (!addIngId || !addQty) return
    await supabase.from('recipe_ingredients').insert({ recipe_id: recipe.id, ingredient_id: addIngId, quantity: Number(addQty) })
    setAddIngId(''); setAddQty('')
    load()
  }
  async function removeLink(id) {
    await supabase.from('recipe_ingredients').delete().eq('id', id)
    load()
  }

  const totalCost = links.reduce((sum, l) => {
    const ing = allIngredients.find(i => i.id === l.ingredient_id)
    return sum + (ing ? ing.current_price * l.quantity : 0)
  }, 0)
  const costPct = recipe.selling_price > 0 ? (totalCost / recipe.selling_price * 100) : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:560}}>
        <div style={{display:'flex', justifyContent:'space-between'}}><h2>{recipe.name} — Σύνθεση</h2><button className="icon-btn" onClick={onClose}><X/></button></div>

        <table style={{marginBottom:12}}>
          <thead><tr><th>Πρώτη Ύλη</th><th>Ποσότητα</th><th>Κόστος</th><th></th></tr></thead>
          <tbody>
            {links.map(l => {
              const ing = allIngredients.find(i => i.id === l.ingredient_id)
              return (
                <tr key={l.id}>
                  <td>{ing?.name || '-'}</td>
                  <td>{l.quantity} {ing?.unit}</td>
                  <td>{ing ? (ing.current_price * l.quantity).toFixed(3) : '-'} €</td>
                  <td><button className="icon-btn danger" onClick={() => removeLink(l.id)}><Trash2 size={14}/></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <select value={addIngId} onChange={e => setAddIngId(e.target.value)} style={{flex:1}}>
            <option value="">Επιλογή πρώτης ύλης...</option>
            {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
          <input type="number" step="0.001" placeholder="ποσότητα" value={addQty} onChange={e => setAddQty(e.target.value)} style={{width:100}}/>
          <button className="btn" onClick={addLink}><Plus size={16}/></button>
        </div>

        <div className="card" style={{background:'var(--olive-50)'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <div><div className="stat-label">Κόστος Πιάτου</div><div className="stat-value">{totalCost.toFixed(2)} €</div></div>
            <div><div className="stat-label">Τιμή Πώλησης</div><div className="stat-value">{Number(recipe.selling_price).toFixed(2)} €</div></div>
            <div><div className="stat-label">Food Cost %</div>
              <div className="stat-value" style={{color: costPct > 35 ? 'var(--danger)' : costPct > 28 ? 'var(--warn)' : 'var(--ok)'}}>
                {costPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
