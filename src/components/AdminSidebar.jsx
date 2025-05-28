import { NavLink } from 'react-router-dom'

export default function AdminSidebar() {
  const navItems = [
    { label: 'Events', path: '/admin/events' },
    { label: 'Queue', path: '/admin/queue' },
    { label: 'Add Vinyl', path: '/admin/add-vinyl' },
    { label: 'Import Collection', path: '/admin/import' },
    { label: 'Now Playing', path: '/admin/now-playing' },
    { label: 'Logout', path: '/' },
  ]

  return (
    <div className="w-48 bg-gray-100 h-screen p-4 border-r fixed">
      <h2 className="text-lg font-bold mb-6">Admin</h2>
      <ul className="space-y-3">
        {navItems.map(item => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                isActive
                  ? 'text-blue-600 font-semibold'
                  : 'text-gray-700 hover:text-blue-600'
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
