import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const label = seg.toLowerCase();
    return ` • ${label}`;
  });

  return (
    <nav className="breadcrumb">
      <span>
        <Link to="/">home</Link>
        {crumbs}
      </span>
    </nav>
  );
};

export default Breadcrumbs;
