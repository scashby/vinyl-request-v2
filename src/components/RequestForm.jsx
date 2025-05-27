import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RequestForm({ eventId }) {
  const [formData, setFormData] = useState({ artist: '', title: '', side: '', name: '', comment: '' })
  const [status, setStatus] = useState(null)

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('requests').insert([
      { ...formData, event_id: eventId, status: 'queued', votes: 1 }
    ])
    if (error) setStatus('Error submitting request.')
    else setStatus('Request submitted!')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-2">Request a Side</h2>
      <div className="space-y-2">
        <input type="text" name="artist" placeholder="Artist" onChange={handleChange} required className="w-full p-2 border rounded" />
        <input type="text" name="title" placeholder="Album Title" onChange={handleChange} required className="w-full p-2 border rounded" />
        <input type="text" name="side" placeholder="Side (A/B/C...)" onChange={handleChange} required className="w-full p-2 border rounded" />
        <input type="text" name="name" placeholder="Your Name" onChange={handleChange} required className="w-full p-2 border rounded" />
        <textarea name="comment" placeholder="(Optional) Comment" onChange={handleChange} className="w-full p-2 border rounded" />
        <button className="bg-green-600 text-white py-2 px-4 rounded">Submit</button>
        {status && <p className="text-sm text-center text-gray-600 mt-2">{status}</p>}
      </div>
    </form>
  )
}