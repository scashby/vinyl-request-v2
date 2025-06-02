import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const trail = segments.map(seg => seg.toLowerCase()).join(' • ');

  return (
    <nav className="breadcrumb">
      <span className="breadcrumb-content">
        <Link to="/">home</Link>
        {trail ? <span> • {trail}</span> : ''}
      </span>
    </nav>
  );
};

export default Breadcrumbs;
