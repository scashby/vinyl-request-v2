import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function BrowsePage() {
  const [albums, setAlbums] = useState([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const fetchAlbums = async () => {
      const { data, error } = await supabase.from('collection').select('*')
      if (error) console.error('Error fetching albums:', error)
      else setAlbums(data)
    }
    fetchAlbums()
  }, [])

  const filtered = albums.filter(album => {
    const str = `${album.artist} ${album.title} ${album.format}`.toLowerCase()
    return str.includes(filter.toLowerCase())
  })

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Browse Collection</h1>
      <input
        type="text"
        placeholder="Search artist, title, format..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map(album => (
          <div key={album.id} className="border rounded p-3">
            <img src={album.image_url || '/placeholder.png'} alt={album.title} className="w-full h-40 object-cover mb-2" />
            <p className="font-semibold">{album.artist}</p>
            <p className="text-sm text-gray-700">{album.title} ({album.year})</p>
            <p className="text-xs text-gray-500">Format: {album.format}</p>
          </div>
        ))}
      </div>
    </div>
  )
}