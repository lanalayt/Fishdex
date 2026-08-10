import { Platform } from 'react-native';

let isOnline = true;

export function getIsOnline() { return isOnline; }

export function initConnectivity() {
  if (Platform.OS === 'web') {
    isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { isOnline = true; });
      window.addEventListener('offline', () => { isOnline = false; });
    }
  } else {
    // On native, try a simple fetch to check connectivity
    checkConnectivity();
  }
}

export async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/generate_204', { method: 'HEAD' });
    isOnline = response.ok;
  } catch {
    isOnline = false;
  }
  return isOnline;
}
