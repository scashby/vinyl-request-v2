import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function SetNowPlaying() {
  const [queue, setQueue] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('requests').select('*').eq('status', 'queued')
      setQueue(data || [])
    }
    load()
  }, [])

  const updateStatus = async (id, status) => {
    await supabase.from('requests').update({ status }).eq('id', id)
    alert(`${status.replace('_', ' ')} set.`)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Set Now Playing / Up Next</h2>
      <ul className="space-y-3">
        {queue.map(req => (
          <li key={req.id} className="border p-3 rounded flex justify-between items-center">
            <div>
              {req.artist} — {req.title} (Side {req.side})<br />
              <span className="text-sm text-gray-500">Requested by {req.name}</span>
            </div>
            <div className="space-x-2">
              <button onClick={() => updateStatus(req.id, 'now_playing')} className="px-2 py-1 bg-blue-500 text-white rounded">Now</button>
              <button onClick={() => updateStatus(req.id, 'up_next')} className="px-2 py-1 bg-purple-500 text-white rounded">Next</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}