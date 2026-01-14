import React from 'react';

const PageLayout = ({ children }) => (
  <div className="page-container">
    <main className="page-body">{children}</main>
  </div>
);

export default PageLayout;