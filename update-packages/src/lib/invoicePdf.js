import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const num = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
const isNum = (s) => /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)

// Διαβάζει ηλεκτρονικό τιμολόγιο PDF (Epsilon Digital / FastReport) και επιστρέφει επικεφαλίδα + γραμμές
export async function parseInvoicePdf(file) {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const rows = []
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items.filter(i => i.str.trim())
    const byY = []
    for (const it of items) {
      const y = it.transform[5]
      let r = byY.find(r => Math.abs(r.y - y) < 3)
      if (!r) byY.push(r = { y, items: [] })
      r.items.push(it)
    }
    byY.sort((a, b) => b.y - a.y)
    for (const r of byY) rows.push(r.items.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str.trim()).join(' ').replace(/\s+/g, ' '))
  }
  const text = rows.join('\n')
  const head = text.match(/([Α-ΩA-Z]{1,5})\s+(\d{2,})\s+(\d{2})\/(\d{2})\/(\d{4})/)
  const mark = text.match(/ΜΑΡΚ:?\s*(\d{10,})/)
  const lines = []
  for (const row of rows) {
    const tk = row.split(' ')
    if (tk.length < 11) continue
    const tail = tk.slice(-8)
    if (!tail.every(isNum)) continue
    const unit = tk[tk.length - 9]
    const code = tk[0]
    if (!/\d/.test(code) || /^\d+([.,]\d+)?$/.test(code) && !code.includes('.')) continue
    const qty = num(tail[0]), net = num(tail[6])
    if (!(qty > 0)) continue
    lines.push({ code, description: tk.slice(1, -9).join(' '), unit, qty, net, price: Math.round((net / qty) * 10000) / 10000 })
  }
  return {
    supplierName: (rows[0] || '').replace(/\s+/g, ' ').trim(),
    number: head ? `${head[1]}-${head[2]}` : '',
    date: head ? `${head[5]}-${head[4]}-${head[3]}` : '',
    mark: mark ? mark[1] : '',
    lines,
  }
}
