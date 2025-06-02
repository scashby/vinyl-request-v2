import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav className="breadcrumb">
      <Link to="/">Home</Link>
      {segments.map((seg, idx) => {
        const path = '/' + segments.slice(0, idx + 1).join('/');
        const label = seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const isLast = idx === segments.length - 1;

        return (
          <span key={path}>
            {' / '}
            {isLast ? (
              <span>{label}</span>
            ) : (
              <Link to={path}>{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
