// Per-device settings (design §4.10): the Bee URL and the batch id never leave the browser; nothing is hardcoded (T3).
export interface Settings { beeUrl: string; stamp: string; allowFallback: boolean; zoom: number }
const KEY = 'swarmtyp:settings';
const defaults: Settings = { beeUrl: import.meta.env.VITE_BEE_URL || 'http://127.0.0.1:1633', stamp: import.meta.env.VITE_STAMP || '', allowFallback: true, zoom: 1 };
export function loadSettings(): Settings { try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...defaults }; } }
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
