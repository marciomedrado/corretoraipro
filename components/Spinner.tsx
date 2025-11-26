import React from 'react';

export const Spinner: React.FC = () => (
  <div className="flex justify-center items-center space-x-2">
    <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce delay-75"></div>
    <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce delay-150"></div>
    <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce delay-300"></div>
  </div>
);