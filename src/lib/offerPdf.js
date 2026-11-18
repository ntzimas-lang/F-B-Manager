import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Επιστρέφει το κείμενο κάθε σελίδας του PDF, γραμμή-γραμμή, με " | " ανάμεσα στις στήλες
export async function pdfPagesText(file) {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items.filter(i => i.str.trim())
    const rows = []
    for (const it of items) {
      const y = it.transform[5]
      let r = rows.find(r => Math.abs(r.y - y) < 3)
      if (!r) rows.push(r = { y, items: [] })
      r.items.push(it)
    }
    rows.sort((a, b) => b.y - a.y)
    pages.push(rows.map(r => r.items.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str.trim()).join(' | ')).join('\n'))
  }
  return pages
}
