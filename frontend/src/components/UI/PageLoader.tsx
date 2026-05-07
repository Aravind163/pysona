import React from 'react';

export const PageLoader = ({ loading }: { loading: boolean }) => {
  if (!loading) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 overflow-hidden">
      <div className="h-full bg-[#EF5900] animate-pulse" style={{ width: '100%', animation: 'progress 0.4s ease-out' }} />
      <style>{`@keyframes progress { from { width: 0%; opacity: 1; } to { width: 100%; opacity: 0; } }`}</style>
    </div>
  );
};
