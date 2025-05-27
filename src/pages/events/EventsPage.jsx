
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function EventsPage() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })

      if (error) console.error(error)
      else setEvents(data)
    }

    fetchEvents()
  }, [])

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upcoming Events</h1>
      <ul className="space-y-3">
        {events.map(event => (
          <li key={event.id} className="border rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-gray-600">{event.date} @ {event.time}</p>
            </div>
            <Link to={`/event/${event.id}`} className="text-blue-600 underline text-sm">View</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
