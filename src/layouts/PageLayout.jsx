import React from 'react';
import 'src/styles/internal.css';

const PageLayout = ({ children }) => (
  <div className="page-container">
    <main className="page-body">{children}</main>
  </div>
);

export default PageLayout;