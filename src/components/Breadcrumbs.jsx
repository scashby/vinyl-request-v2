import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const trail = segments.map(seg => seg.toLowerCase()).join(' • ');

  return (
    <p className="breadcrumb">
      <Link to="/" className="breadcrumb-link">home</Link>
      {trail ? ` • ${trail}` : ''}
    </p>
  );
};

export default Breadcrumbs;
