'use client';

import { HashLoader } from 'react-spinners';

interface LoadingSpinnerProps {
  color?: string;
  backgroundColor?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  color = '#3e4c5e',
  backgroundColor,
  fullScreen = true,
}: LoadingSpinnerProps) {
  const sizeClass = fullScreen ? 'min-h-screen' : 'py-2';

  return (
    <div className={`${sizeClass} flex items-center justify-center ${backgroundColor || ''}`}>
      <HashLoader color={color} size={35} />
    </div>
  );
}
