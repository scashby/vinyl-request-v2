import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function EventDetail() {
  const { id } = useParams()
  const [requests, setRequests] = useState([])

  useEffect(() => {
    const fetchRequests = async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', id)
        .order('votes', { ascending: false })

      if (error) console.error('Error loading queue:', error)
      else setRequests(data)
    }

    fetchRequests()
    const interval = setInterval(fetchRequests, 10000)
    return () => clearInterval(interval)
  }, [id])

  const upvote = async (reqId) => {
    await supabase.rpc('increment_vote', { request_id: reqId })
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Current Queue</h1>
      <ul className="space-y-4">
        {requests.map((req) => (
          <li key={req.id} className="border rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">{req.artist} — {req.title} (Side {req.side})</p>
              <p className="text-sm text-gray-500">Requested by {req.name}</p>
            </div>
            <button
              onClick={() => upvote(req.id)}
              className="text-sm bg-blue-500 text-white px-2 py-1 rounded"
            >
              👍 {req.votes}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}