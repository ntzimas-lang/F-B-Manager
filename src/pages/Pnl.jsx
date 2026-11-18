import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './pnl.css'

const FIELDS = {
  days: 350, covers: 80, avgFood: 18, avgBev: 3, avgAlc: 6, otherRev: 30000,
  fc: 30, bc: 22, ac: 25,
  lc: 26, rent: 9, util: 3.5, mkt: 2, ins: 1, maint: 1.3, supp: 1.2, admin: 1.5, otherOp: 1,
  da: 14000, intx: 5000, taxrate: 22,
}
const fmt = (n) => { const s = Math.abs(n).toLocaleString('el-GR', { maximumFractionDigits: 0 }) + ' €'; return n < 0 ? '(' + s + ')' : s }
const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1) + '%' : '—')

function Field({ label, id, v, set, unit, hint, step }) {
  return (
    <div className="row">
      <div className="row-flex">
        <label>{label}</label>
        <span><input type="number" value={v[id]} step={step} onChange={(e) => set({ ...v, [id]: e.target.value })} />{unit && <span className="unit">{unit}</span>}</span>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export default function Pnl() {
  const { role, isPlatformAdmin, profile } = useAuth()
  const [v, set] = useState(FIELDS)
  if (!profile) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Φόρτωση...</div>
  const n = (k) => { const x = parseFloat(v[k]); return isNaN(x) ? 0 : x }
  const coversYear = n('days') * n('covers')
  const food = coversYear * n('avgFood'), bev = coversYear * n('avgBev'), alc = coversYear * n('avgAlc')
  const rev = food + bev + alc + n('otherRev')
  const cogs = food * n('fc') / 100 + bev * n('bc') / 100 + alc * n('ac') / 100
  const gross = rev - cogs
  const labor = rev * n('lc') / 100
  const opex = labor + ['rent', 'util', 'mkt', 'ins', 'maint', 'supp', 'admin', 'otherOp'].reduce((s, k) => s + rev * n(k) / 100, 0)
  const ebitda = gross - opex, ebit = ebitda - n('da'), ebt = ebit - n('intx')
  const tax = ebt * n('taxrate') / 100, net = ebt - tax
  const prime = rev ? (cogs + labor) / rev : 0
  const primeColor = prime <= 0.6 ? '#1e7e34' : prime <= 0.65 ? '#b58900' : '#c0392b'
  const F = (p) => <Field v={v} set={set} step="0.1" {...p} />
  return (
    <div className="pnl">
      <div className="wrap">
        <h1>P&amp;L Εστιατορίου</h1>
        <div className="subtitle">Καταχωρείτε λειτουργικούς δείκτες (κουβέρ, FC, BC, LC κ.λπ.) — το P&amp;L υπολογίζεται αυτόματα από κάτω.</div>
        <div className="grid">
          <div className="card">
            <div className="section-title">ΚΟΥΒΕΡ &amp; ΠΩΛΗΣΕΙΣ</div>
            <Field v={v} set={set} id="days" label="Ημέρες λειτουργίας / έτος" />
            <Field v={v} set={set} id="covers" label="Κουβέρ / ημέρα (μέσος όρος πελατών)" hint="Κουβέρ = αριθμός πελατών που εξυπηρετούνται." />
            <Field v={v} set={set} id="avgFood" label="Μέσος λογαριασμός Φαγητού / κουβέρ" />
            <Field v={v} set={set} id="avgBev" label="Μέσος λογαριασμός Ποτών (μη αλκοολ.) / κουβέρ" />
            <Field v={v} set={set} id="avgAlc" label="Μέσος λογαριασμός Αλκοόλ / κουβέρ" />
            <Field v={v} set={set} id="otherRev" label="Λοιπά Έσοδα / έτος (delivery, catering)" />
            <div className="section-title">ΚΟΣΤΟΣ ΠΩΛΗΘΕΝΤΩΝ (% επί πωλήσεων κατηγορίας)</div>
            {F({ id: 'fc', label: 'FC – Food Cost %', unit: '%', hint: "Κόστος α' υλών φαγητού ως % επί των πωλήσεων φαγητού. Στόχος συνήθως 28–35%." })}
            {F({ id: 'bc', label: 'BC – Beverage Cost %', unit: '%', hint: 'Κόστος μη αλκοολούχων ποτών ως % επί των πωλήσεών τους.' })}
            {F({ id: 'ac', label: 'AC – Alcohol Cost %', unit: '%', hint: 'Κόστος αλκοόλ ως % επί των πωλήσεων αλκοόλ.' })}
          </div>
          <div className="card">
            <div className="section-title">ΛΕΙΤΟΥΡΓΙΚΑ ΕΞΟΔΑ (% επί Συνόλου Εσόδων)</div>
            {F({ id: 'lc', label: 'LC – Labor Cost %', unit: '%', hint: 'Κόστος προσωπικού (μισθοί + εισφορές) ως % επί συνόλου εσόδων. Στόχος συνήθως 25–30%.' })}
            {F({ id: 'rent', label: 'Ενοίκιο (Occupancy) %', unit: '%' })}
            {F({ id: 'util', label: 'ΔΕΗ / Νερό / Θέρμανση %', unit: '%' })}
            {F({ id: 'mkt', label: 'Μάρκετινγκ & Διαφήμιση %', unit: '%' })}
            {F({ id: 'ins', label: 'Ασφάλιστρα %', unit: '%' })}
            {F({ id: 'maint', label: 'Συντήρηση & Επισκευές %', unit: '%' })}
            {F({ id: 'supp', label: 'Αναλώσιμα %', unit: '%' })}
            {F({ id: 'admin', label: 'Διοικητικά / Λογιστικά %', unit: '%' })}
            {F({ id: 'otherOp', label: 'Λοιπά Λειτουργικά %', unit: '%' })}
            <div className="section-title">ΑΠΟΣΒΕΣΕΙΣ &amp; ΧΡΗΜΑΤΟΟΙΚΟΝΟΜΙΚΑ</div>
            <Field v={v} set={set} id="da" label="Αποσβέσεις (D&A) / έτος" />
            <Field v={v} set={set} id="intx" label="Τόκοι / έτος" />
            {F({ id: 'taxrate', label: 'Φορολογικός Συντελεστής', unit: '%' })}
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Βασικοί Δείκτες (KPIs)</div>
          <div className="kpis">
            <div className="kpi"><div className="val">{coversYear.toLocaleString('el-GR')}</div><div className="lab">Κουβέρ / έτος</div></div>
            <div className="kpi"><div className="val">{coversYear ? (rev / coversYear).toLocaleString('el-GR', { maximumFractionDigits: 2 }) + ' €' : '—'}</div><div className="lab">Μέσος Λογαριασμός / Κουβέρ</div></div>
            <div className="kpi"><div className="val" style={{ color: primeColor }}>{pct(prime)}</div><div className="lab">Prime Cost % (FC+BC+AC+LC επί εσόδων)</div></div>
          </div>
        </div>
        <div className="results">
          <div className="res-row sub"><span>Σύνολο Εσόδων</span><span>{fmt(rev)}</span></div>
          <div className="res-row"><span>Σύνολο Κόστους Πωληθέντων (COGS)</span><span>{fmt(cogs)}</span></div>
          <div className="res-row total"><span>ΜΙΚΤΟ ΚΕΡΔΟΣ <span className="pct">{rev ? pct(gross / rev) : ''}</span></span><span>{fmt(gross)}</span></div>
          <div className="res-row"><span>Σύνολο Λειτουργικών Εξόδων (με Labor)</span><span>{fmt(opex)}</span></div>
          <div className="res-row total"><span>EBITDA <span className="pct">{rev ? pct(ebitda / rev) : ''}</span></span><span>{fmt(ebitda)}</span></div>
          <div className="res-row"><span>Αποσβέσεις (D&amp;A)</span><span>{fmt(n('da'))}</span></div>
          <div className="res-row sub"><span>EBIT</span><span>{fmt(ebit)}</span></div>
          <div className="res-row"><span>Τόκοι</span><span>{fmt(n('intx'))}</span></div>
          <div className="res-row sub"><span>Κέρδη προ Φόρων (EBT)</span><span>{fmt(ebt)}</span></div>
          <div className="res-row"><span>Φόρος Εισοδήματος</span><span>{fmt(tax)}</span></div>
          <div className="res-row net" style={{ background: net < 0 ? '#c0392b' : '#1F4E78' }}><span>ΚΑΘΑΡΟ ΚΕΡΔΟΣ <span className="pct">{rev ? pct(net / rev) : ''}</span></span><span>{fmt(net)}</span></div>
        </div>
        <div className="glossary">
          <b>FC</b> = Food Cost % (κόστος α' υλών φαγητού ÷ πωλήσεις φαγητού) &nbsp;•&nbsp; <b>BC</b> = Beverage Cost % &nbsp;•&nbsp; <b>AC</b> = Alcohol Cost % &nbsp;•&nbsp; <b>LC</b> = Labor Cost % (κόστος προσωπικού ÷ σύνολο εσόδων) &nbsp;•&nbsp; <b>Κουβέρ</b> = αριθμός πελατών που εξυπηρετούνται &nbsp;•&nbsp; <b>Prime Cost</b> = (COGS + Κόστος Προσωπικού) ÷ Σύνολο Εσόδων. Στόχος: ≤ 60% (πράσινο), 60–65% προσοχή (κίτρινο), &gt;65% κίνδυνος (κόκκινο).
        </div>
        <footer>Όλοι οι υπολογισμοί γίνονται τοπικά στον browser σας.</footer>
      </div>
      {(isPlatformAdmin || role === 'super_user') && <Link to="/" className="hub-pill">← My Business</Link>}
    </div>
  )
}
