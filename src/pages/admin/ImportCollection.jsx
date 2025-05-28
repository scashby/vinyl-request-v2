import { useState } from 'react'
import { parseDiscogsCSV } from '../../lib/csvUtils.js'
import { supabase } from '../../lib/supabaseClient.js'
import CSVPreviewTable from '../../components/CSVPreviewTable'

export default function ImportCollection() {
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (file) parseDiscogsCSV(file, setRows)
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setStatus(null)

    for (const entry of rows) {
      const { artist, title } = entry
      const { data: existing } = await supabase
        .from('collection')
        .select('id')
        .eq('artist', artist)
        .eq('title', title)
        .maybeSingle()

      if (!existing) {
        await supabase.from('collection').insert([entry])
      }
    }

    setImporting(false)
    setStatus('Import complete. Duplicate titles skipped.')
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📥 Import Collection from Discogs</h1>

      <input type="file" accept=".csv" onChange={handleFile} className="mb-4" />
      {rows.length > 0 && (
        <>
          <CSVPreviewTable rows={rows} />
          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
          >
            {importing ? 'Importing...' : 'Import into Collection'}
          </button>
        </>
      )}
      {status && <p className="mt-2 text-green-600">{status}</p>}
    </div>
  )
}