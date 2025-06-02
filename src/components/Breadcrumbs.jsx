import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const trail = segments.map(seg => seg.toLowerCase()).join(' • ');

  return (
    <nav className="breadcrumb">
      <span>
        <Link to="/">home</Link>
        {trail ? ` • ${trail}` : ''}
      </span>
    </nav>
  );
};

export default Breadcrumbs;
