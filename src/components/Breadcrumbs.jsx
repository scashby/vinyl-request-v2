import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav className="breadcrumb">
      <Link to="/">home</Link>
      {segments.map((seg, idx) => {
        const path = '/' + segments.slice(0, idx + 1).join('/');
        const isLast = idx === segments.length - 1;
        return (
          <span key={path}>
            {idx > 0 && <span className="dot-separator"> • </span>}
            {isLast ? (
              <span>{seg.toLowerCase()}</span>
            ) : (
              <Link to={path}>{seg.toLowerCase()}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
