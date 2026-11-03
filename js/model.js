// Le modèle de récupération. Aucune dépendance au navigateur : testé dans test/model.test.js.
//
// Ce n'est pas une mesure de tes poumons : c'est une estimation calée sur des délais publiés.
// Les sources de chaque constante sont dans js/content.js, écran « Sources ».

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;

// Demi-vie du monoxyde de carbone à l'air libre, environ 5 h.
const CO_HALF_LIFE_H = 5;
// Fenêtres de récupération. souffle : OMS 2-12 semaines. cils : OMS 1-9 mois.
// cellules : moitié du bénéfice à 3 ans, proche d'un non-fumeur à 10 ans (Jha 2024).
const COMPARTMENTS = {
  souffle: { tau: 35, hit: 0.004 },
  cils: { tau: 75, hit: 0.004 },
  cellules: { tau: 1580, hit: 0.001 },
};
// Le monoxyde de carbone reste à part : il quitte le sang en un jour et ne dit rien de la guérison des poumons.
const LUNG_PARTS = Object.keys(COMPARTMENTS);
// Mémoire du rythme récent de consommation, en jours.
const RATE_MEMORY_D = 2;
// Une faible consommation garde une grande part du risque : 1 cigarette par jour porte
// environ 46 % de l'excès de risque coronarien de 20 par jour chez l'homme (Hackshaw 2018),
// soit un exposant de 0,26. Choix de modélisation : on l'applique à tous les compartiments.
const DOSE_EXPONENT = 0.26;

function recoveryTarget(rate, perDay) {
  const ratio = Math.min(rate / perDay, 1);
  return ratio <= 0 ? 1 : 1 - ratio ** DOSE_EXPONENT;
}

function scoreOf(c) {
  return LUNG_PARTS.reduce((sum, key) => sum + c[key], 0) / LUNG_PARTS.length;
}

/** État estimé à l'instant `at`, en rejouant chaque cigarette depuis le départ. */
export function simulate(profile, cigs, at) {
  const { start, perDay } = profile;
  const times = cigs.filter((t) => t >= start && t <= at).sort((a, b) => a - b);
  // Valeur à l'équilibre de la consommation habituelle = 1 ; une cigarette ajoute donc :
  const coPerCig = (Math.LN2 / CO_HALF_LIFE_H) * (24 / perDay);
  const coDecayPerH = Math.LN2 / CO_HALF_LIFE_H;

  let x = 1;
  let rate = perDay;
  let cleanDays = 0;
  const r = { souffle: 0, cils: 0, cellules: 0 };
  let t = start;
  let lastEvent = start;

  const advance = (until) => {
    while (t < until) {
      const sinceEvent = t - lastEvent;
      // Pas fins près d'une cigarette, larges ensuite : dix ans restent rapides à rejouer.
      const step = Math.min(until - t, sinceEvent < 14 * DAY ? HOUR : 12 * HOUR);
      const hours = step / HOUR;
      const days = step / DAY;
      x *= Math.exp(-coDecayPerH * hours);
      const mid = rate * Math.exp(-days / (2 * RATE_MEMORY_D));
      rate *= Math.exp(-days / RATE_MEMORY_D);
      const target = recoveryTarget(mid, perDay);
      for (const key of Object.keys(COMPARTMENTS)) {
        r[key] += (target - r[key]) * (1 - Math.exp(-days / COMPARTMENTS[key].tau));
      }
      cleanDays += days;
      t += step;
    }
  };

  for (const cig of times) {
    advance(cig);
    x += coPerCig;
    rate += 1 / RATE_MEMORY_D;
    for (const key of Object.keys(COMPARTMENTS)) r[key] *= 1 - COMPARTMENTS[key].hit;
    // Un écart recule d'environ un jour, davantage plus on a de jours à perdre.
    cleanDays = Math.max(0, cleanDays - (1 + 0.03 * cleanDays));
    lastEvent = cig;
  }
  advance(at);

  const co = Math.max(0, Math.min(1, 1 - x));
  const state = { co, souffle: r.souffle, cils: r.cils, cellules: r.cellules };
  return {
    ...state,
    score: scoreOf(state),
    rate,
    cleanDays,
    lastCig: times.length ? times[times.length - 1] : null,
  };
}

/** Plafond de récupération atteignable si on reste indéfiniment à `perDayNow` cigarettes par jour. */
export function ceilingAt(profile, perDayNow) {
  if (perDayNow <= 0) return 1;
  const target = recoveryTarget(perDayNow, profile.perDay);
  const eq = {};
  for (const key of LUNG_PARTS) {
    const { tau, hit } = COMPARTMENTS[key];
    eq[key] = (target / tau) / (1 / tau + perDayNow * hit);
  }
  return scoreOf(eq);
}

export function money(profile, cigs, at) {
  const perCig = profile.packPrice / profile.packSize;
  const expected = profile.perDay * Math.max(0, at - profile.start) / DAY;
  const smoked = cigs.filter((t) => t >= profile.start && t <= at).length;
  return {
    perCig,
    expected,
    smoked,
    perDay: perCig * profile.perDay,
    saved: Math.max(0, expected - smoked) * perCig,
    spentSince: smoked * perCig,
    burned: profile.years * 365.25 * profile.perDay * perCig,
    notSmoked: Math.max(0, expected - smoked),
  };
}

export function packRemaining(profile, cigs) {
  if (profile.packDiscardedAt) return 0;
  return Math.max(0, profile.packStart - cigs.filter((t) => t >= profile.start).length);
}

/** Traduit l'état estimé en paramètres visuels pour le shader. */
export function visual(s) {
  const left = 1 - s.score;
  return {
    flesh: Math.min(1, 0.12 * s.co + 0.88 * s.score ** 0.85),
    tar: 0.58 * left ** 1.1,
    oxy: s.co,
    airway: s.cils,
    haze: left ** 1.5,
    breathDepth: 0.4 + 0.6 * s.souffle,
    breathPeriod: 3.4 + 1.8 * s.souffle,
  };
}

/** Cigarettes par jour calendaire sur les `n` derniers jours, du plus ancien au plus récent. */
export function dailyCounts(cigs, now, n = 14) {
  const days = [];
  const end = new Date(now);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const next = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i + 1);
    days.push({ day: d.getTime(), count: cigs.filter((t) => t >= d.getTime() && t < next.getTime()).length });
  }
  return days;
}
