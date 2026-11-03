import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import { notoSansBase64 } from '../assets/notoSansFont'

// Ετικέτες Α4: 3 στήλες × 7 γραμμές (63,5 × 38,1 mm), barcode Code128 με τον κωδικό της πρώτης ύλης.
export function makeLabelsPdf(items, { copies = 1, frame = true, fileName = 'etiketes' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.addFileToVFS('NotoSans.ttf', notoSansBase64)
  doc.addFont('NotoSans.ttf', 'NotoSans', 'normal')
  doc.setFont('NotoSans', 'normal')
  const W = 63.5, H = 38.1, COLS = 3, ROWS = 7
  const left = (210 - W * COLS) / 2, top = (297 - H * ROWS) / 2
  const list = items.filter(i => i.code).flatMap(i => Array(Math.max(1, copies)).fill(i))
  const canvas = document.createElement('canvas')
  list.forEach((it, n) => {
    if (n > 0 && n % (COLS * ROWS) === 0) doc.addPage()
    const k = n % (COLS * ROWS)
    const x = left + (k % COLS) * W, y = top + Math.floor(k / COLS) * H
    if (frame) { doc.setDrawColor(200); doc.setLineWidth(0.1); doc.rect(x, y, W, H) }
    doc.setTextColor(30)
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(it.name || '', W - 8).slice(0, 2)
    doc.text(lines, x + W / 2, y + 6, { align: 'center' })
    JsBarcode(canvas, String(it.code), { format: 'CODE128', displayValue: false, margin: 0, width: 3, height: 70 })
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x + 6.5, y + 13, W - 13, 14)
    doc.setFontSize(11)
    doc.text(String(it.code), x + W / 2, y + 32, { align: 'center' })
    if (it.unit) { doc.setFontSize(7); doc.setTextColor(120); doc.text(String(it.unit).toUpperCase(), x + W - 3, y + H - 2.5, { align: 'right' }) }
  })
  doc.save(`${fileName}-${new Date().toISOString().slice(0, 10)}.pdf`)
  return list.length
}
