import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const Breadcrumbs = () => {
  const location = useLocation();
  const { id } = useParams();
  const [eventTitle, setEventTitle] = useState(null);

  const segments = location.pathname.split('/').filter(Boolean);
  const paths = segments.map((_, index) => '/' + segments.slice(0, index + 1).join('/'));

  useEffect(() => {
    const fetchEventTitle = async () => {
      if (segments[0] === 'events' && id) {
        const { data, error } = await supabase
          .from('events')
          .select('title')
          .eq('id', id)
          .single();
        if (!error) setEventTitle(data.title);
      }
    };
    fetchEventTitle();
  }, [id]);

  return (
    <p className="breadcrumb">
      <Link to="/" className="breadcrumb-link">home</Link>
      {segments.map((seg, idx) => {
        const path = paths[idx];
        const label =
          idx === segments.length - 1 && eventTitle ? eventTitle.toLowerCase() : seg.toLowerCase();
        return (
          <React.Fragment key={path}>
            {' / '}
            <Link to={path} className="breadcrumb-link">
              {label}
            </Link>
          </React.Fragment>
        );
      })}
    </p>
  );
};

export default Breadcrumbs;
