import { useEffect, useState } from 'react';

export interface OnlineStatusState {
  isOnline: boolean;
  wasOffline: boolean;
  lastChangedAt: number;
}

export function useOnlineStatus(): OnlineStatusState {
  const [state, setState] = useState<OnlineStatusState>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastChangedAt: Date.now(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setState((prev) => ({
        isOnline: true,
        wasOffline: prev.isOnline ? prev.wasOffline : true,
        lastChangedAt: Date.now(),
      }));
    };

    const handleOffline = () => {
      setState({
        isOnline: false,
        wasOffline: true,
        lastChangedAt: Date.now(),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
}
