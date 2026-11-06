import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BUSINESS_APPS } from '../lib/businessApps'

export default function MyBusiness() {
  const { session, signOut } = useAuth()
  return (
    <div className="hub">
      <div className="hub-inner">
        <h1>My Business</h1>
        <p className="hub-sub">Οι εφαρμογές της δουλειάς μου σε ένα μέρος</p>
        <div className="hub-grid">
          {BUSINESS_APPS.map((a) => {
            const body = (<><div className="hub-ico">{a.icon}</div><h2>{a.title}</h2><p>{a.desc}</p>{!a.to && !a.url && <span className="hub-soon">Σύντομα</span>}</>)
            if (a.to) return <Link key={a.id} to={a.to} className="hub-card">{body}</Link>
            if (a.url && a.external) return <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="hub-card">{body}</a>
            if (a.url) return <Link key={a.id} to={`/app/${a.id}`} className="hub-card">{body}</Link>
            return <div key={a.id} className="hub-card off">{body}</div>
          })}
        </div>
        <div className="hub-foot">{session?.user?.email} · <button onClick={signOut}>Αποσύνδεση</button></div>
      </div>
    </div>
  )
}

export function EmbeddedApp() {
  const { id } = useParams()
  const app = BUSINESS_APPS.find((a) => a.id === id)
  if (!app?.url) return <div className="hub"><Link to="/">← My Business</Link></div>
  return (
    <div className="embed">
      <iframe src={app.url} title={app.title} allow="camera; clipboard-write; fullscreen" />
      <Link to="/" className="hub-pill">← My Business</Link>
    </div>
  )
}

// Κέλυφος για τις ανεξάρτητες εφαρμογές του My Business (εκτός F&B Manager)
export function AppShell({ title, children }) {
  return (
    <div className="shell">
      <div className="shell-in">
        <h1 style={{ marginBottom: 14 }}>{title}</h1>
        {children}
      </div>
      <Link to="/" className="hub-pill">← My Business</Link>
    </div>
  )
}
