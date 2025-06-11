import Papa from 'papaparse'

// 🛠 Extract, normalize fields
export function parseDiscogsCSV(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data.map(row => ({
        artist: row['Artist'],
        title: row['Title'],
        format: row['Format'],
        folder: row['Folder'],
        year: parseInt(row['Year'], 10) || null,
        media_condition: row['Media Condition'],
        image_url: row['External Images'] || '',
        notes: row['Notes'],
      }))
      callback(rows)
    },
    error: (err) => {
      console.error('CSV parse error:', err)
      callback([])
    }
  })
}
