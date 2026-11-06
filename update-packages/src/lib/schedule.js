// Λογική προγράμματος βαρδιών (καθαρές συναρτήσεις). ctx = { ym, stores, staff, cells }
// stores: [{id,name,weekend,open24,openFrom,openTo,sheet,shifts:[{wd,we,times:[t]}]}]
// staff: [{id,name,code,home,kind:'shift'|'fixed',fixedTime,fixedDays}]
// cells: { [staffId]: { [day]: {k:'w'|'r'|'a', t?:'HH:MM-HH:MM', s?:storeId} } }

export const DOW = ['Κ', 'ΔΕ', 'ΤΡ', 'ΤΕ', 'ΠΕ', 'ΠΑ', 'Σ']
export const DOW_LONG = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
export const ISO_SHORT = ['', 'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ']
export const MON = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
export const MON_GEN = ['ΙΑΝΟΥΑΡΙΟΥ', 'ΦΕΒΡΟΥΑΡΙΟΥ', 'ΜΑΡΤΙΟΥ', 'ΑΠΡΙΛΙΟΥ', 'ΜΑΪΟΥ', 'ΙΟΥΝΙΟΥ', 'ΙΟΥΛΙΟΥ', 'ΑΥΓΟΥΣΤΟΥ', 'ΣΕΠΤΕΜΒΡΙΟΥ', 'ΟΚΤΩΒΡΙΟΥ', 'ΝΟΕΜΒΡΙΟΥ', 'ΔΕΚΕΜΒΡΙΟΥ']
export const SHIFT_LBL = { P: 'Πρωί', A: 'Απόγευμα', N: 'Νύχτα' }
export const KEYS = ['P', 'A', 'N']

export const yp = (ym) => ym.split('-').map(Number)
export const daysIn = (ym) => { const [y, m] = yp(ym); return new Date(y, m, 0).getDate() }
export const dowOf = (ym, d) => { const [y, m] = yp(ym); return new Date(y, m - 1, d).getDay() }
export const isWE = (ym, d) => { const w = dowOf(ym, d); return w === 0 || w === 6 }
export const isoDow = (ym, d) => { const w = dowOf(ym, d); return w === 0 ? 7 : w }
export const weekKey = (ym, d) => d - (isoDow(ym, d) - 1)
export const shiftKey = (t) => { const m = /^(\d{1,2})/.exec(t || ''); if (!m) return 'P'; const h = +m[1]; return h < 12 ? 'P' : h < 20 ? 'A' : 'N' }

export function normTime(t) {
  t = String(t || '').replace(/\s+/g, '').replace(/[–—.]/g, (m) => (m === '.' ? ':' : '-'))
  const m = /^(\d{1,2}):?(\d{2})-(\d{1,2}):?(\d{2})$/.exec(t)
  if (!m) return null
  const p = (n) => String(n).padStart(2, '0')
  if (+m[1] > 23 || +m[3] > 23 || +m[2] > 59 || +m[4] > 59) return null
  return p(+m[1]) + ':' + m[2] + '-' + p(+m[3]) + ':' + m[4]
}
export function oneT(x) {
  x = String(x || '').trim().replace(/[.,]/g, ':')
  const m = /^(\d{1,2}):(\d{2})$/.exec(x) || /^(\d{1,2})(\d{2})$/.exec(x) || /^(\d{1,2})$/.exec(x)
  if (!m) return null
  const h = +m[1], mi = +(m[2] || 0)
  if (h > 23 || mi > 59) return null
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0')
}
export const shTime = (sh) => (sh.times && sh.times[0]) || '07:00-15:00'
export const toMin = (x) => { const m = /^(\d{1,2}):(\d{2})$/.exec(x || ''); return m ? +m[1] * 60 + +m[2] : null }
export function span(t) {
  const [a, b] = String(t || '').split('-'); const s = toMin(a), e = toMin(b)
  if (s == null || e == null) return null
  let d = e - s; if (d <= 0) d += 1440
  return { s, d }
}
export const hm = (m) => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }
export const fmtH = (m) => { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}:${String(r).padStart(2, '0')}` : String(h) }
export const shortT = (x) => String(x || '').split('-').map((p) => { const m = /^(\d{1,2}):?(\d{2})?$/.exec(p.trim()); return m ? m[1].padStart(2, '0') + ':' + (m[2] || '00') : p }).join('–')

export const DEFAULT_SHIFTS = [{ wd: 1, we: 1, times: ['07:00-15:00'] }]

export function groups(st) {
  const out = []
  for (const k of KEYS) {
    const shs = (st.shifts || []).filter((sh) => shiftKey(shTime(sh)) === k)
    if (shs.length) out.push({ k, label: SHIFT_LBL[k], wd: shs.reduce((a, x) => a + (+x.wd || 0), 0), we: shs.reduce((a, x) => a + (+x.we || 0), 0), times: shs.map(shTime) })
  }
  return out
}
export const storeOpen = (st, ym, d) => st && (st.weekend || !isWE(ym, d))
export const cellOf = (ctx, sid, d) => { const r = ctx.cells && ctx.cells[sid]; return r ? r[d] || null : null }

export function sixthDays(ctx, sid) {
  const out = new Set(), cnt = {}, n = daysIn(ctx.ym)
  for (let d = 1; d <= n; d++) {
    const c = cellOf(ctx, sid, d)
    if (c && c.k === 'w') { const w = weekKey(ctx.ym, d); cnt[w] = (cnt[w] || 0) + 1; if (cnt[w] >= 6) out.add(d) }
  }
  return out
}
export function coverage(ctx) {
  const cov = {}, n = daysIn(ctx.ym)
  for (const s of ctx.staff) for (let d = 1; d <= n; d++) {
    const c = cellOf(ctx, s.id, d); if (!c || c.k !== 'w') continue
    const st = c.s || s.home, k = shiftKey(c.t)
    cov[st] = cov[st] || {}; cov[st][d] = cov[st][d] || {}; cov[st][d][k] = (cov[st][d][k] || 0) + 1
  }
  return cov
}
export function gapsFor(ctx, st, cov) {
  let g = 0; const n = daysIn(ctx.ym)
  for (let d = 1; d <= n; d++) {
    if (!storeOpen(st, ctx.ym, d)) continue
    const we = isWE(ctx.ym, d)
    for (const sh of groups(st)) {
      const need = we ? sh.we : sh.wd
      const have = (((cov[st.id] || {})[d] || {})[sh.k]) || 0
      if (have < need) g += need - have
    }
  }
  return g
}

// ---------- Αναφορές ----------
export function buildReport(ctx) {
  const { ym, stores, staff } = ctx
  const n = daysIn(ym), cov = coverage(ctx), issues = [], OT = {}, otList = [], OT_MAX = 120
  const dl = (d) => `${DOW[dowOf(ym, d)]} ${d}/${yp(ym)[1]}`
  const storeName = (id) => (stores.find((s) => s.id === id) || {}).name || ''
  const storeRep = stores.map((st) => {
    let otMins = 0, need = 0, have = 0, short = 0, over = 0, mins = 0
    for (let d = 1; d <= n; d++) {
      if (!storeOpen(st, ym, d)) continue
      const we = isWE(ym, d)
      for (const sh of groups(st)) {
        const nd = we ? sh.we : sh.wd, hv = (((cov[st.id] || {})[d] || {})[sh.k]) || 0
        need += nd; have += Math.min(hv, nd)
        if (hv < nd) { short += nd - hv; issues.push({ type: 'gap', store: st.id, d, text: `${st.name} · ${sh.label}: λείπ${nd - hv === 1 ? 'ει 1 άτομο' : 'ουν ' + (nd - hv) + ' άτομα'}` }) }
        if (hv > nd) over += hv - nd
      }
    }
    for (const s of staff) for (let d = 1; d <= n; d++) {
      const c = cellOf(ctx, s.id, d)
      if (c && c.k === 'w' && (c.s || s.home) === st.id) { const sp = span(c.t); if (sp) mins += sp.d }
    }
    const ivs = (d) => {
      const out = []
      for (const s of staff) for (const dd of [d - 1, d]) {
        if (dd < 1) continue
        const c = cellOf(ctx, s.id, dd)
        if (!c || c.k !== 'w' || (c.s || s.home) !== st.id) continue
        const sp = span(c.t); if (!sp) continue
        const off = (dd - d) * 1440
        out.push([sp.s + off, sp.s + sp.d + off, dd === d, s])
      }
      return out
    }
    const oF = toMin(st.openFrom), oT0 = toMin(st.openTo)
    const win = st.open24 ? [0, 1440] : (oF != null && oT0 != null ? [oF, oT0 > oF ? oT0 : oT0 + 1440] : null)
    const firsts = {}, lasts = {}; let hourIssues = 0
    for (let d = 1; d <= n; d++) {
      if (!storeOpen(st, ym, d)) continue
      const iv = ivs(d), today = iv.filter((x) => x[2])
      if (today.length) { const f = Math.min(...today.map((x) => x[0])), l = Math.max(...today.map((x) => x[1])); firsts[f] = (firsts[f] || 0) + 1; lasts[l] = (lasts[l] || 0) + 1 }
      if (!win) continue
      const segs = iv.map((x) => [Math.max(x[0], win[0]), Math.min(x[1], win[1])]).filter((x) => x[1] > x[0]).sort((a, b) => a[0] - b[0])
      const holes = []; let cur = win[0]
      for (const [a, b] of segs) { if (a > cur) holes.push([cur, a]); cur = Math.max(cur, b) }
      if (cur < win[1]) holes.push([cur, win[1]])
      if (d === 1 && st.open24) while (holes.length && holes[0][0] === win[0]) holes.shift()
      const big = []
      for (const [a, b] of holes) {
        const len = b - a, who = iv.find((x) => x[1] === a) || iv.find((x) => x[0] === b)
        if (len <= OT_MAX && who) {
          const ps = who[3]; OT[ps.id] = (OT[ps.id] || 0) + len; otMins += len
          otList.push({ type: 'ot', store: st.id, d, text: `${ps.name} · ${st.name} · ${who[1] === a ? 'μένει' : 'έρχεται νωρίτερα'} ${hm(a)}–${hm(b)} (${fmtH(len)} ώρες)` })
        } else big.push([a, b])
      }
      if (big.length) { hourIssues++; issues.push({ type: 'hours', store: st.id, d, text: `${st.name} · κανείς ${big.map(([a, b]) => hm(a) + '–' + hm(b)).join(', ')}` }) }
    }
    const mode = (o) => { const e = Object.entries(o).sort((a, b) => b[1] - a[1] || a[0] - b[0]); return e.length ? +e[0][0] : null }
    return { st, need, have, short, over, mins, pct: need ? have / need : 1, win, first: mode(firsts), last: mode(lasts), hourIssues, otMins }
  })
  const people = staff.map((s) => {
    const six = sixthDays(ctx, s.id); let work = 0, off = 0, lv = 0, night = 0, cross = 0, mins = 0, empty = 0; const pi = []
    let prevEnd = null, prevD = null
    const home = stores.find((x) => x.id === s.home)
    for (let d = 1; d <= n; d++) {
      const c = cellOf(ctx, s.id, d)
      if (!c) { if ((home && storeOpen(home, ym, d)) || s.kind !== 'fixed') empty++; prevEnd = null; continue }
      if (c.k === 'r') { off++; prevEnd = null; continue }
      if (c.k === 'a') { lv++; prevEnd = null; continue }
      work++; const sp = span(c.t)
      if (c.s && c.s !== s.home) cross++
      if (shiftKey(c.t) === 'N') night++
      if (sp) {
        mins += sp.d; const start = d * 1440 + sp.s
        if (prevEnd != null && prevD === d - 1) { const rest = start - prevEnd; if (rest < 660) pi.push({ type: 'rest', store: s.home, d, text: `${s.name} · ανάπαυση μόνο ${fmtH(Math.max(0, rest))} ώρες πριν τη βάρδια` }) }
        prevEnd = start + sp.d; prevD = d
      } else prevEnd = null
    }
    for (const d of six) pi.push({ type: 'six', store: s.home, d, text: `${s.name} · 6η μέρα εργασίας στην εβδομάδα` })
    if (empty) pi.push({ type: 'empty', store: s.home, d: null, text: `${s.name} · ${empty} ${empty === 1 ? 'μέρα' : 'μέρες'} χωρίς τίποτα στο πρόγραμμα` })
    issues.push(...pi)
    return { s, store: storeName(s.home), work, off, lv, night, cross, mins, six: six.size, issues: pi.length, ot: OT[s.id] || 0 }
  })
  const T = { need: 0, have: 0, short: 0, mins: 0 }
  storeRep.forEach((x) => { T.need += x.need; T.have += x.have; T.short += x.short; T.mins += x.mins })
  return { stores: storeRep, people, issues, otList, otTotal: Object.values(OT).reduce((a, b) => a + b, 0), T, lv: people.reduce((a, p) => a + p.lv, 0), six: people.reduce((a, p) => a + p.six, 0), cross: people.reduce((a, p) => a + p.cross, 0), dl }
}

// ---------- Αυτόματο πρόγραμμα ----------
export function generate(ctx) {
  const { ym, stores, staff } = ctx
  const n = daysIn(ym), old = ctx.cells || {}, out = {}
  const storeBy = (id) => stores.find((s) => s.id === id)
  staff.forEach((s) => { out[s.id] = {}; for (let d = 1; d <= n; d++) { const c = (old[s.id] || {})[d]; if (c && c.k === 'a') out[s.id][d] = { k: 'a', ...(c.t ? { t: c.t } : {}) } } })
  const leave = (s, d) => !!out[s.id][d]
  const fixed = staff.filter((s) => s.kind === 'fixed' && storeBy(s.home))
  const flex = staff.filter((s) => s.kind !== 'fixed' && storeBy(s.home))
  for (const s of fixed) {
    const st = storeBy(s.home)
    for (let d = 1; d <= n; d++) {
      if (leave(s, d)) continue
      out[s.id][d] = ((s.fixedDays || []).includes(isoDow(ym, d)) && storeOpen(st, ym, d) && s.fixedTime) ? { k: 'w', t: s.fixedTime } : { k: 'r' }
    }
  }
  const fixedCov = (stId, d, k) => fixed.filter((s) => s.home === stId && out[s.id][d] && out[s.id][d].k === 'w' && shiftKey(out[s.id][d].t) === k).length
  const needOf = (st, d) => { if (!storeOpen(st, ym, d)) return 0; const we = isWE(ym, d); return groups(st).reduce((a, sh) => a + Math.max(0, (we ? sh.we : sh.wd) - fixedCov(st.id, d, sh.k)), 0) }
  // 1. ρεπό
  const weeks = {}
  for (let d = 1; d <= n; d++) (weeks[weekKey(ym, d)] = weeks[weekKey(ym, d)] || []).push(d)
  const off = {}; flex.forEach((s) => { off[s.id] = new Set() })
  Object.values(weeks).forEach((days, wi) => {
    const len = days.length, restN = Math.round(2 * len / 7)
    for (const st of stores) {
      const grp = flex.filter((s) => s.home === st.id); if (!grp.length) continue
      const slack = {}; for (const d of days) slack[d] = grp.filter((s) => !leave(s, d)).length - needOf(st, d)
      const rot = grp.map((s, i) => grp[(i + wi) % grp.length])
      rot.forEach((s, pi) => {
        const lv = days.filter((d) => leave(s, d)).length; let r = Math.max(0, restN - lv)
        const free = days.filter((d) => !leave(s, d) && !off[s.id].has(d))
        const tie = (d) => ((d + pi * 3) % 7) / 100
        if (r >= 2) {
          let best = null, bs = -1e9
          for (let i = 0; i < free.length - 1; i++) { const a = free[i], b = free[i + 1]; if (b !== a + 1) continue; const sc = Math.min(slack[a], slack[b]) * 10 + slack[a] + slack[b] + tie(a); if (sc > bs) { bs = sc; best = [a, b] } }
          if (best && bs >= 0) { best.forEach((d) => { off[s.id].add(d); slack[d]-- }); r -= 2 }
        }
        while (r > 0) {
          const cand = days.filter((d) => !leave(s, d) && !off[s.id].has(d)); if (!cand.length) break
          cand.sort((a, b) => (slack[b] + tie(b)) - (slack[a] + tie(a))); off[s.id].add(cand[0]); slack[cand[0]]--; r--
        }
      })
    }
  })
  // 2. βάρδιες μέρα με τη μέρα
  const last = {}, order = { N: 0, A: 1, P: 2 }
  for (let d = 1; d <= n; d++) {
    const we = isWE(ym, d), slots = []
    for (const st of stores) {
      if (!storeOpen(st, ym, d)) continue
      for (const k of KEYS) {
        const ts = []
        for (const sh of st.shifts || []) { if (shiftKey(shTime(sh)) !== k) continue; const nd = +(we ? sh.we : sh.wd) || 0; for (let i = 0; i < nd; i++) ts.push(shTime(sh)) }
        for (const f of fixed) { const c = out[f.id][d]; if (f.home !== st.id || !c || c.k !== 'w' || shiftKey(c.t) !== k) continue; const ix = ts.indexOf(c.t); ts.splice(ix >= 0 ? ix : 0, 1) }
        ts.forEach((t, i) => slots.push({ st: st.id, k, i, t }))
      }
    }
    slots.sort((a, b) => order[a.k] - order[b.k])
    const free = new Set(flex.filter((s) => !leave(s, d) && !off[s.id].has(d)).map((s) => s.id))
    const ok = (s, sl) => { const p = last[s.id]; if (p && p.k === 'N' && sl.k !== 'N') return false; if (p && p.k === 'A' && sl.k === 'P') return false; return true }
    const place = (sl, pool) => {
      let best = null, bs = -1e9
      for (const s of pool) {
        if (!free.has(s.id) || !ok(s, sl)) continue
        const p = last[s.id]; let sc = 0
        if (p && p.k === sl.k && p.s === sl.st) sc += 30
        if (sl.k === 'N' && p && p.k === 'N') sc += 50
        sc -= Object.values(out[s.id]).filter((c) => c.k === 'w').length * 0.1
        if (sc > bs) { bs = sc; best = s }
      }
      if (!best) return false
      out[best.id][d] = { k: 'w', t: sl.t, ...(sl.st !== best.home ? { s: sl.st } : {}) }; free.delete(best.id); return true
    }
    const left = []
    for (const sl of slots) { if (!place(sl, flex.filter((s) => s.home === sl.st))) left.push(sl) }
    for (const sl of left) place(sl, flex)
    for (const s of flex) { if (!out[s.id][d]) out[s.id][d] = { k: 'r' }; const c = out[s.id][d]; last[s.id] = c.k === 'w' ? { k: shiftKey(c.t), s: c.s || s.home, t: c.t } : null }
  }
  return out
}
