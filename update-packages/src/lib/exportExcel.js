import writeXlsxFile from 'write-excel-file/browser'

const HEADER = { fontWeight: 'bold', backgroundColor: '#e9edd9' }

// sheets: [{ name, rows: [[...], ...] }] — η πρώτη γραμμή κάθε φύλλου είναι οι επικεφαλίδες
export async function exportXlsx(fileName, sheets) {
  const data = sheets.map((s) => {
    const rows = s.rows.map((r, i) => r.map((c) => {
      if (c === null || c === undefined || c === '') return null
      if (i === 0) return { value: String(c), ...HEADER }
      if (typeof c === 'number' || typeof c === 'boolean' || c instanceof Date) return c
      return String(c)
    }))
    const widths = (s.rows[0] || []).map((_, ci) => Math.min(40, Math.max(10, ...s.rows.map(r => String(r[ci] ?? '').length + 2))))
    return { data: rows, sheet: String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), columns: widths.map(w => ({ width: w })) }
  })
  await writeXlsxFile(data).toFile(fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}
