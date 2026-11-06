export const PRICE_ALERT_PCT = 10

// rows: [{ ingredient_id, unit_price, date }]. Επιστρέφει τις αυξήσεις (τελευταία vs προηγούμενη τιμή) ανά πρώτη ύλη.
export function priceIncreases(rows, threshold = PRICE_ALERT_PCT) {
  const byIng = {}
  for (const r of rows) {
    if (!(Number(r.unit_price) > 0)) continue
    ;(byIng[r.ingredient_id] ||= []).push({ date: r.date, price: Number(r.unit_price) })
  }
  const out = []
  for (const [id, list] of Object.entries(byIng)) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    if (list.length < 2) continue
    const last = list[list.length - 1], prev = list[list.length - 2]
    const pct = ((last.price - prev.price) / prev.price) * 100
    if (pct >= threshold) out.push({ ingredient_id: id, prev: prev.price, last: last.price, pct, date: last.date })
  }
  return out.sort((a, b) => b.pct - a.pct)
}

// Όλες οι μεταβολές τιμής (αυξήσεις και μειώσεις): τελευταία vs προηγούμενη, μαζί με εύρος min–max της περιόδου.
export function priceChanges(rows) {
  const byIng = {}
  for (const r of rows) {
    if (!(Number(r.unit_price) > 0)) continue
    ;(byIng[r.ingredient_id] ||= []).push({ date: r.date, price: Number(r.unit_price) })
  }
  const out = []
  for (const [id, list] of Object.entries(byIng)) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    if (list.length < 2) continue
    const last = list[list.length - 1], prev = list[list.length - 2]
    const prices = list.map(x => x.price)
    const pct = ((last.price - prev.price) / prev.price) * 100
    out.push({ ingredient_id: id, prev: prev.price, last: last.price, pct, date: last.date, min: Math.min(...prices), max: Math.max(...prices), count: list.length })
  }
  return out.filter(o => Math.abs(o.pct) >= 0.5).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
}
