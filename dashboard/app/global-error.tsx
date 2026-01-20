// global-error.tsx - Global error handler for the application
'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // SECURITY: Filter out Server Action attack attempts from logs
    const errorMessage = error.message || '';

    if (errorMessage.includes('Failed to find Server Action')) {
      // This is likely a malicious request, log minimally
      console.warn('[Security] Blocked invalid Server Action request');
      return;
    }

    // Log legitimate errors
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>
            Something went wrong!
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            An error occurred while processing your request.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
