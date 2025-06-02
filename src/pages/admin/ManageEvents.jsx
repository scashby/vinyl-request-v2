
import React from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import '../../styles/breadcrumb.css';

const ManageEvents = () => {
  return (
    <div className="admin-wrapper">
      <Breadcrumbs />
      <div className="admin-header">
        <h1>Manage Events</h1>
        <Link to="/admin/events/new" className="btn btn-primary">➕ Add New Event</Link>
      </div>
      {/* Existing event list rendering here */}
    </div>
  );
};

export default ManageEvents;
