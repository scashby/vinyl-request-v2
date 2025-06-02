import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav className="breadcrumb">
      <span className="crumb">
        <Link to="/" className="crumb-link">home</Link>
      </span>
      {segments.map((seg, idx) => (
        <span key={idx} className="crumb">
          {' • '}
          <span>{seg.toLowerCase()}</span>
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
