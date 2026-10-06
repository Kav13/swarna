import { electronApi } from '../electron/preload';

// Typed bridge interface
export type ElectronApi = typeof electronApi;

declare global {
  interface Window {
    api?: ElectronApi;
  }
}

// Fallback in case window.api is undefined (e.g. tests or direct browser load)
export const api: ElectronApi =
  typeof window !== 'undefined' && window.api
    ? window.api
    : ({} as ElectronApi);
