import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function Breadcrumbs() {
  const location = useLocation();
  const { id } = useParams();
  const [dynamicTitle, setDynamicTitle] = useState(null);

  const stateTrail = location.state?.trail || null;
  const pathname = location.pathname;
  const pathSegments = pathname.split('/').filter(Boolean);
  const paths = pathSegments.map((_, index) => '/' + pathSegments.slice(0, index + 1).join('/'));

  useEffect(() => {
    const fetchTitle = async () => {
      if (pathname.startsWith('/events/') && id) {
        const { data, error } = await supabase
          .from('events')
          .select('title')
          .eq('id', id)
          .single();
        if (!error) setDynamicTitle(data.title);
      }
    };
    fetchTitle();
  }, [id, pathname]);

  const renderTrail = () => {
    if (stateTrail) {
      return stateTrail.map((item, idx) => {
        const path = paths[idx] || '/';
        return (
          <React.Fragment key={path}>
            {' / '}
            <Link to={path} className="breadcrumb-link">
              {item.toLowerCase()}
            </Link>
          </React.Fragment>
        );
      });
    }

    return pathSegments.map((seg, idx) => {
      const path = paths[idx];
      const isLast = idx === pathSegments.length - 1;
      const label =
        isLast && dynamicTitle
          ? dynamicTitle.toLowerCase()
          : decodeURIComponent(seg).toLowerCase();

      return (
        <React.Fragment key={path}>
          {' / '}
          <Link to={path} className="breadcrumb-link">
            {label}
          </Link>
        </React.Fragment>
      );
    });
  };

  return (
    <p className="breadcrumb">
      <Link to="/" className="breadcrumb-link">home</Link>
      {renderTrail()}
    </p>
  );
}

export default Breadcrumbs;
