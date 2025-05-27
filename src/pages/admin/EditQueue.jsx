import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function EditQueue() {
  const [queue, setQueue] = useState([])

  useEffect(() => {
    const loadQueue = async () => {
      const { data, error } = await supabase.from('requests').select('*').eq('status', 'queued')
      if (error) console.error(error)
      else setQueue(data)
    }
    loadQueue()
  }, [])

  const markPlayed = async (id) => {
    await supabase.from('requests').update({ status: 'played' }).eq('id', id)
    setQueue(queue.filter(r => r.id !== id))
  }

  const remove = async (id) => {
    await supabase.from('requests').delete().eq('id', id)
    setQueue(queue.filter(r => r.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Manage Queue</h2>
      <ul className="space-y-3">
        {queue.map(req => (
          <li key={req.id} className="p-3 border rounded flex justify-between items-center">
            <div>
              <p>{req.artist} — {req.title} (Side {req.side})</p>
              <p className="text-sm text-gray-500">Requested by {req.name}</p>
            </div>
            <div className="space-x-2">
              <button onClick={() => markPlayed(req.id)} className="px-2 py-1 bg-green-500 text-white rounded">Played</button>
              <button onClick={() => remove(req.id)} className="px-2 py-1 bg-red-500 text-white rounded">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}