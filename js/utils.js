// utils.js  
export function savePref(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
export function loadPref(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
