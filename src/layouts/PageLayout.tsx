import React, { ReactNode } from 'react';

const PageLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col bg-gray-50">
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </main>
  </div>
);

export default PageLayout;