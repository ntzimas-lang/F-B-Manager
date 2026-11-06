import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

function shrink(canvas) {
  let q = 0.72, url
  do { url = canvas.toDataURL('image/jpeg', q); q -= 0.1 } while (url.length > 230000 && q > 0.25)
  return url
}
// PDF ή φωτογραφία → λίστα από εικόνες jpeg (data URL), έως 4 σελίδες
export async function fileToPages(f) {
  if (f.type === 'application/pdf') {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
    const out = []
    for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
      const pg = await pdf.getPage(p)
      const vp0 = pg.getViewport({ scale: 1 })
      const vp = pg.getViewport({ scale: 1300 / vp0.width })
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
      await pg.render({ canvasContext: x, viewport: vp }).promise
      out.push(shrink(c))
    }
    return out
  }
  const url = URL.createObjectURL(f)
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url })
  const sc = Math.min(1, 1400 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc)
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return [shrink(c)]
}
