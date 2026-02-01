'use client';

import { HashLoader } from 'react-spinners';

interface LoadingSpinnerProps {
  color?: string;
  backgroundColor?: string;
}

export default function LoadingSpinner({ color = '#3b82f6', backgroundColor }: LoadingSpinnerProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${backgroundColor || ''}`}>
      <HashLoader color={color} size={60} />
    </div>
  );
}
