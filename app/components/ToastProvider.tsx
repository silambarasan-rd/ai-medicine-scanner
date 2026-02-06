'use client';

import { ToastContainer, Bounce } from 'react-toastify';

export default function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick={false}
      rtl={false}
      draggable
      theme="light"
      transition={Bounce}
    />
  );
}
