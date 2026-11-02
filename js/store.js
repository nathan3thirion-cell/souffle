// Les données restent dans le téléphone, aucun serveur. Sauvegarde possible en fichier.
import { DEFAULT_PLANS } from './content.js';

const KEY = 'souffle.v1';

export const DEFAULT_PROFILE = { perDay: 10, packPrice: 12.5, packSize: 20, years: 10, packStart: 10 };

export function freshState() {
  return {
    version: 1,
    profile: null,
    cigs: [],
    wins: [],
    plans: DEFAULT_PLANS.map((p) => ({ ...p })),
    reasons: '',
    note: '',
    goal: { name: '', price: 0 },
    gateOpens: 0,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...freshState(), ...JSON.parse(raw) } : freshState();
  } catch {
    return freshState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Demande au navigateur de ne pas effacer les données quand il manque de place. */
export function askPersistence() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

export function exportFile(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `souffle-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function parseImport(text) {
  const data = JSON.parse(text);
  if (!data || !data.profile || !Array.isArray(data.cigs)) throw new Error('Ce fichier n\'est pas une sauvegarde de Souffle.');
  return { ...freshState(), ...data };
}
