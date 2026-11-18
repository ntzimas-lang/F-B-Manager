const STOP = new Set(['ΚΙΛΟ', 'ΚΙΛΩΝ', 'ΤΕΜ', 'ΔΟΧ', 'ΠΑΚ', 'ΓΡ', 'ΛΙΤΡΩΝ', 'ΛΙΤΡΟΥ', 'ΜΕ', 'ΚΑΙ', 'ΤΟΥ', 'ΤΗΣ', 'ΧΥΜΑ'])
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/ς/g, 'Σ').replace(/[^A-ZΑ-Ω0-9 ]/g, ' ')
function toks(s) {
  return norm(s).split(/\s+/).filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t)).map(t => t.slice(0, 6))
}
// Ομοιότητα ονομάτων 0..1 (Dice πάνω σε λέξεις, με κοινό πρόθεμα 6 γραμμάτων)
export function similarity(a, b) {
  const A = toks(a), B = toks(b)
  if (!A.length || !B.length) return 0
  const setB = new Set(B)
  const common = A.filter(t => setB.has(t)).length
  return (2 * common) / (A.length + B.length)
}
export function bestMatch(name, ingredients, min = 0.5) {
  let best = null, score = 0
  for (const ing of ingredients) {
    const s = similarity(name, ing.name)
    if (s > score) { score = s; best = ing }
  }
  return score >= min ? { ingredient: best, score } : null
}
const UNIT = { ΚΙΛΟ: 'kg', ΚΙΛ: 'kg', KG: 'kg', ΚΙΛΟΥ: 'kg', ΤΕΜ: 'pc', ΤΕΜΑΧΙΟ: 'pc', ΛΙΤΡΟ: 'l', ΛΙΤΡΑ: 'l', LT: 'l', L: 'l' }
export function unitKey(u) {
  const k = norm(u).replace(/\s+/g, '')
  return UNIT[k] || null
}
export const sameUnit = (a, b) => { const x = unitKey(a), y = unitKey(b); return !!x && x === y }
