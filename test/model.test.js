import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, money, ceilingAt, visual, packRemaining, HOUR, DAY } from '../js/model.js';

const T0 = Date.UTC(2026, 10, 2, 12);
const profile = { start: T0, perDay: 10, packPrice: 12.5, packSize: 20, years: 10, packStart: 10 };
const at = (days) => T0 + days * DAY;
const score = (cigs, days) => simulate(profile, cigs, at(days)).score;

test('au départ, rien n\'est récupéré', () => {
  const s = simulate(profile, [], T0);
  assert.equal(s.co, 0);
  assert.equal(s.score, 0);
});

test('monoxyde de carbone : quasi normal en 12 h (OMS), évacué en 24 h', () => {
  assert.ok(simulate(profile, [], T0 + 12 * HOUR).co > 0.78);
  assert.ok(simulate(profile, [], T0 + 24 * HOUR).co > 0.95);
});

test('le monoxyde de carbone ne compte pas dans le pourcentage des poumons', () => {
  const s = simulate(profile, [], T0 + 50 * HOUR);
  assert.ok(s.co > 0.99);
  assert.ok(s.score < 0.01, `50 h ${s.score}`);
});

test('la courbe suit les délais publiés si on ne refume plus', () => {
  assert.ok(score([], 7) > 0.02 && score([], 7) < 0.05, `7 j ${score([], 7)}`);
  assert.ok(score([], 30) > 0.18 && score([], 30) < 0.35, `30 j ${score([], 30)}`);
  assert.ok(score([], 365) > 0.65 && score([], 365) < 0.8, `1 an ${score([], 365)}`);
  assert.ok(score([], 3650) > 0.95, `10 ans ${score([], 3650)}`);
});

test('souffle : l\'essentiel du gain tombe dans la fenêtre 2-12 semaines (OMS)', () => {
  const s = simulate(profile, [], at(84));
  assert.ok(s.souffle > 0.75, `12 sem ${s.souffle}`);
});

test('cellules : moitié du bénéfice vers 3 ans, quasi complet à 10 ans (Jha 2024)', () => {
  const y3 = simulate(profile, [], at(3 * 365)).cellules;
  const y10 = simulate(profile, [], at(10 * 365)).cellules;
  assert.ok(y3 > 0.42 && y3 < 0.56, `3 ans ${y3}`);
  assert.ok(y10 > 0.85, `10 ans ${y10}`);
});

test('la récupération ne redescend jamais sans cigarette', () => {
  let prev = 0;
  for (const d of [0.1, 0.5, 1, 3, 7, 14, 30, 90, 365, 1000]) {
    const v = score([], d);
    assert.ok(v >= prev);
    prev = v;
  }
});

test('un seul écart après un mois coûte peu et se rattrape', () => {
  const slip = [at(30)];
  const before = score([], 30);
  const just = score(slip, 30.01);
  assert.ok(before - just < 0.12, `perte ${before - just}`);
  const later = score(slip, 60);
  assert.ok(score([], 60) - later < 0.05, `écart à 60 j ${score([], 60) - later}`);
});

test('reprendre 10 par jour efface vraiment les progrès', () => {
  const relapse = [];
  for (let d = 30; d < 120; d += 0.1) relapse.push(at(d));
  assert.ok(score(relapse, 120) < 0.08, `${score(relapse, 120)}`);
});

test('fumer tous les jours comme avant reste à zéro', () => {
  const same = [];
  for (let d = 0; d < 60; d += 0.1) same.push(at(d));
  assert.ok(score(same, 60) < 0.03, `${score(same, 60)}`);
});

test('diminuer aide, mais bien moins qu\'arrêter', () => {
  const series = (gap) => { const a = []; for (let d = 0; d < 180; d += gap) a.push(at(d)); return a; };
  const five = score(series(0.2), 180);
  const one = score(series(1), 180);
  const zero = score([], 180);
  const ten = score(series(0.1), 180);
  assert.ok(ten < five && five < one && one < zero, `${ten} ${five} ${one} ${zero}`);
  assert.ok(five > 0.03 && five < 0.2, `5/j ${five}`);
  assert.ok(one < 0.55, `1/j ${one}`);
  assert.ok(zero > 0.55, `0/j ${zero}`);
});

test('plafond : à ton rythme actuel on ne dépasse pas X', () => {
  assert.equal(ceilingAt(profile, 0), 1);
  assert.ok(ceilingAt(profile, 5) < 0.2);
  assert.ok(ceilingAt(profile, 1) > ceilingAt(profile, 5));
  assert.ok(ceilingAt(profile, 10) < 0.01);
});

test('jours gagnés : un écart recule les paliers sans les effacer', () => {
  assert.ok(Math.abs(simulate(profile, [], at(30)).cleanDays - 30) < 0.01);
  const d = simulate(profile, [at(30)], at(30.001)).cleanDays;
  assert.ok(d > 27 && d < 30, `${d}`);
  const daily = []; for (let k = 0; k < 40; k++) daily.push(at(k));
  assert.ok(simulate(profile, daily, at(39.5)).cleanDays < 1);
});

test('argent : 6,25 € par jour sans fumer, 0 € si on fume comme avant', () => {
  assert.ok(Math.abs(money(profile, [], at(1)).saved - 6.25) < 1e-9);
  assert.ok(Math.abs(money(profile, [], at(365)).saved - 2281.25) < 1e-6);
  const ten = Array.from({ length: 10 }, (_, i) => T0 + i * HOUR);
  assert.ok(money(profile, ten, at(1)).saved < 1e-9);
  // Le détail affiché dans l'écran Argent : 1 jour attendu = 10 clopes, 4 notées, 6 pas fumées.
  const four = money(profile, [T0 + HOUR, T0 + 2 * HOUR, T0 + 3 * HOUR, T0 + 4 * HOUR], at(1));
  assert.ok(Math.abs(four.expected - 10) < 1e-9);
  assert.equal(four.smoked, 4);
  assert.ok(Math.abs(four.notSmoked - 6) < 1e-9);
  assert.ok(Math.abs(four.saved - 3.75) < 1e-9);
  assert.ok(Math.abs(money(profile, [], at(0)).perCig - 0.625) < 1e-9);
  assert.ok(Math.abs(money(profile, [], at(0)).burned - 22828.125) < 1e-6);
});

test('dernier paquet : le compteur descend et s\'arrête à zéro', () => {
  assert.equal(packRemaining(profile, []), 10);
  assert.equal(packRemaining(profile, [T0 + HOUR, T0 + 2 * HOUR]), 8);
  assert.equal(packRemaining(profile, Array(14).fill(T0 + HOUR)), 0);
  assert.equal(packRemaining({ ...profile, packDiscardedAt: T0 }, []), 0);
});

test('l\'image change dès le premier jour, puis jusqu\'au bout', () => {
  const v0 = visual(simulate(profile, [], T0));
  const v1 = visual(simulate(profile, [], at(1)));
  const vY = visual(simulate(profile, [], at(365)));
  const v10 = visual(simulate(profile, [], at(3650)));
  assert.ok(v1.flesh > v0.flesh + 0.1);
  assert.ok(vY.tar < v1.tar);
  assert.ok(v10.tar < 0.02 && v10.flesh > 0.95);
});
