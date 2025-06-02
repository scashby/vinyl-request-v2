import React from 'react';
import '../../styles/internal.css';

const AdminDashboard = () => {
  return (
    <div className="admin-dashboard" style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ color: '#222', marginBottom: '1.5rem' }}>Admin Dashboard</h1>
      <ul style={{ listStyle: 'none', padding: 0, fontSize: '1.1rem' }}>
        <li style={{ marginBottom: '1rem' }}>
          <a href="/admin/events" style={{ color: '#2563eb', textDecoration: 'none' }}>Manage Events</a>
        </li>
        <li style={{ marginBottom: '1rem' }}>
          <a href="/admin/queue" style={{ color: '#2563eb', textDecoration: 'none' }}>Manage Queues</a>
        </li>
        <li style={{ marginBottom: '1rem' }}>
          <a href="/admin/collection" style={{ color: '#2563eb', textDecoration: 'none' }}>Manage Collection</a>
        </li>
      </ul>
    </div>
  );
};

export default AdminDashboard;
