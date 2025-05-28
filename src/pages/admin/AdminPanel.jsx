import { Outlet } from 'react-router-dom'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminPanel() {
  return (
    <div className="flex">
      <AdminSidebar />
      <div className="ml-48 p-6 w-full">
        <Outlet />
      </div>
    </div>
  )
}
