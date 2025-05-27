
import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Vinyl Request</h1>
        <nav className="space-x-4 text-sm">
          <Link to="/" className="hover:underline">Events</Link>
          <Link to="/browse" className="hover:underline">Browse</Link>
          <Link to="/now-playing" className="hover:underline">Now Playing</Link>
        </nav>
      </div>
    </header>
  )
}
