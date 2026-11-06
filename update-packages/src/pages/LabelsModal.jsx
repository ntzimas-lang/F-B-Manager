import { useState } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { makeLabelsPdf } from '../lib/labels'

export default function LabelsModal({ items, onClose }) {
  const { t } = useLanguage()
  const [copies, setCopies] = useState(1)
  const [frame, setFrame] = useState(true)
  const withCode = items.filter(i => i.code)
  function go() {
    makeLabelsPdf(withCode, { copies: Number(copies) || 1, frame })
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>{t('labels')}</h2><button className="icon-btn" onClick={onClose}><X /></button></div>
        <p>{withCode.length} {t('labelsFor')} · {Math.ceil(withCode.length * (Number(copies) || 1) / 21)} {t('pagesA4')}</p>
        <div className="form-row"><label>{t('copiesPerItem')}</label><input type="number" min="1" max="20" value={copies} onChange={e => setCopies(e.target.value)} /></div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" checked={frame} onChange={e => setFrame(e.target.checked)} /> {t('labelFrame')}</label>
        <div className="modal-actions"><button className="btn" onClick={go} disabled={withCode.length === 0}>{t('createPdf')}</button></div>
      </div>
    </div>
  )
}
