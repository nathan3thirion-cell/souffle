import { Lungs } from './lungs.js';
import { simulate, money, ceilingAt, visual, packRemaining, dailyCounts, DAY } from './model.js';
import { SOURCES, MILESTONES, COMPARTMENT_INFO, FIRST_DAYS, TRIGGERS, MOVES } from './content.js';
import { load, save, freshState, DEFAULT_PROFILE, askPersistence, exportFile, parseImport } from './store.js';

const TEL = '080011100';
const SOS_SECONDS = 300;
const GATE_SECONDS = 600;

let S = load();
const ui = { tab: 'poumons', mode: 'home', step: 1, sosPane: 'respire', sosStart: 0, sosLength: SOS_SECONDS, futureIndex: 3 };
let lungs = null;
let lastSim = null;

// --- Formats ---
const euro = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
const euro0 = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur = (v) => euro.format(v);
const eur0 = (v) => euro0.format(v);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');

function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor(s / 60) % 60;
  if (d >= 1) return `${d} j ${h} h`;
  if (h >= 1) return `${h} h ${pad(m)} min`;
  return `${m} min ${pad(s % 60)} s`;
}

function until(days) {
  const hours = days * 24;
  if (hours < 1) return `${Math.max(1, Math.ceil(hours * 60))} min`;
  if (hours < 48) return `${Math.ceil(hours)} h`;
  return `${Math.ceil(days)} jours`;
}

const clock = (t) => new Date(t).toLocaleString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const trigName = (id) => (TRIGGERS.find((t) => t.id === id) || {}).label || '';
const source = (id) => `<a class="src" href="${SOURCES[id].url}" target="_blank" rel="noopener">${esc(SOURCES[id].label)}</a>`;

// --- Lecture de l'état ---
const cigTimes = () => S.cigs.map((c) => c.t);
const remaining = () => packRemaining(S.profile, cigTimes());
const inPackPhase = () => remaining() > 0;
const lastSmoke = () => { const t = cigTimes(); return t.length ? Math.max(...t) : S.profile.start; };
const quitDay = () => Math.floor((Date.now() - lastSmoke()) / DAY);

function persist() {
  if (!save(S)) toast('Impossible d\'enregistrer sur ce téléphone. Fais une sauvegarde depuis Aide.');
}

function currentSim(at = Date.now()) {
  return simulate(S.profile, cigTimes(), at);
}

function refreshLungs(opts) {
  if (!S.profile) return;
  lastSim = currentSim();
  if (lungs && ui.mode !== 'future') lungs.setState(visual(lastSim), opts);
}

function nextMilestone(sim) {
  return MILESTONES.find((m) => sim.cleanDays < m.at);
}

// --- Rendu général ---
const root = document.getElementById('app');
root.innerHTML = `
  <div class="stage" id="stage"><canvas id="lungs" role="img" aria-label="Tes poumons, qui s'éclaircissent avec la récupération"></canvas><div class="overlay" id="overlay"></div></div>
  <div class="content" id="content"></div>
  <nav class="tabs" id="tabs" aria-label="Navigation"></nav>`;
const stage = document.getElementById('stage');
const content = document.getElementById('content');
const overlay = document.getElementById('overlay');
const tabs = document.getElementById('tabs');

const ICONS = {
  poumons: '<path d="M12 3v8m0 0-2.2 2.4M12 11l2.2 2.4"/><path d="M8.6 7.2C6 8.6 4 12.4 3.6 17.3c-.1 1.700 1 2.700 2.400 2.200l2.600-1c1-.4 1.500-1.200 1.500-2.300v-7.600c0-1-.8-1.700-1.500-1.400Z"/><path d="M15.400 7.200c2.600 1.400 4.600 5.200 5 10.100.1 1.700-1 2.700-2.400 2.200l-2.600-1c-1-.4-1.500-1.200-1.500-2.300v-7.600c0-1 .8-1.700 1.500-1.400Z"/>',
  argent: '<path d="M17 6.500A6.500 6.500 0 0 0 7 12a6.500 6.500 0 0 0 10 5.500"/><path d="M4 10.300h9M4 13.700h8"/>',
  parcours: '<path d="M4 20c5 0 3-6 8-6s3-6 8-6"/><circle cx="4" cy="20" r="1"/><circle cx="20" cy="8" r="1"/><path d="M20 4v1"/>',
  aide: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3.200"/><path d="m6 6 3.700 3.700M18 6l-3.700 3.700M6 18l3.700-3.700M18 18l-3.700-3.700"/>',
};
const TAB_LABELS = { poumons: 'Poumons', argent: 'Argent', parcours: 'Parcours', aide: 'Aide' };

function render() {
  if (!S.profile) return renderOnboarding();
  // Pendant une envie, rien d'autre à l'écran que la respiration et la sortie
  tabs.style.display = ui.mode === 'sos' ? 'none' : '';
  tabs.innerHTML = Object.keys(TAB_LABELS).map((t) => `
    <button class="tab" data-act="tab" data-x="${t}" ${ui.tab === t ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t]}</svg>${TAB_LABELS[t]}
    </button>`).join('');
  stage.classList.remove('onboard-stage');
  const showStage = ui.tab === 'poumons';
  stage.hidden = !showStage;
  if (lungs) { if (showStage) { lungs.start(); requestAnimationFrame(() => lungs.resize()); } else lungs.stop(); }
  if (showStage) {
    content.className = 'content';
    overlay.innerHTML = overlayHtml();
    content.innerHTML = ui.mode === 'sos' ? sosHtml() : ui.mode === 'future' ? futureHtml() : homeHtml();
  } else {
    content.className = 'content page';
    content.innerHTML = ui.tab === 'argent' ? moneyHtml() : ui.tab === 'parcours' ? journeyHtml() : helpHtml();
    content.scrollTop = 0;
  }
  tick();
}

// --- Accueil ---
function overlayHtml() {
  if (ui.mode === 'sos') {
    return `<div class="readout"><div class="readout-value num" data-live="sos-timer">5:00</div><span class="readout-label">L'envie monte, puis elle retombe.</span></div>`;
  }
  if (ui.mode === 'future') return '';
  return `
    <button class="readout" data-act="details" aria-label="Voir le détail de la récupération">
      <div class="readout-value num"><span data-live="score">0</span><small>%</small></div>
      <span class="readout-label">récupéré, estimation</span>
    </button>
    <button class="pill" data-act="future">Et si je tiens ?</button>`;
}

function homeHtml() {
  const left = remaining();
  const total = Math.max(S.profile.packStart, left);
  const packRow = inPackPhase()
    ? `<div class="pack">
         <div class="pack-label"><strong>${left === 1 ? 'La dernière' : `${left} clopes`}</strong><br>${left === 1 ? 'du dernier paquet' : 'avant ton Jour 0'}</div>
         <div class="sticks" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="stick${i >= left ? ' gone' : ''}"></i>`).join('')}</div>
       </div>`
    : `<div class="pack"><div class="pack-label"><strong>${S.wins.length} ${S.wins.length > 1 ? 'envies battues' : 'envie battue'}</strong></div><div class="pack-label">Jour <strong class="num">${quitDay()}</strong></div></div>`;
  return `<div class="panel">
    <div class="facts">
      <div class="fact"><small>Sans fumer depuis</small><b class="num" data-live="since">0 s</b></div>
      <div class="fact"><small>Argent gardé</small><b class="num" data-live="saved">0 €</b></div>
    </div>
    <button class="next" data-act="tab" data-x="parcours" data-live="next"></button>
    ${packRow}
    <div class="actions">
      <button class="btn btn-main" data-act="sos">J'ai envie de fumer</button>
      <button class="btn btn-soft" data-act="smoke">J'en fume une</button>
    </div>
  </div>`;
}

// --- Détail des poumons ---
function recentRate() {
  const now = Date.now();
  const since = Math.max(S.profile.start, now - 7 * DAY);
  const count = cigTimes().filter((t) => t >= since).length;
  return count / Math.max(1, (now - since) / DAY);
}

function openDetails() {
  const sim = currentSim();
  const rate = recentRate();
  openSheet(`
    <h2 class="title">Ce qui se passe dans tes poumons</h2>
    <p>Une estimation calée sur les délais publiés. Ce n'est pas une mesure de tes poumons : seul un médecin peut mesurer ton souffle.</p>
    ${rate > 0 ? `<div class="warn">À ton rythme des 7 derniers jours (${rate.toFixed(1).replace('.', ',')} par jour), la récupération plafonne vers ${Math.round(ceilingAt(S.profile, rate) * 100)} %. À zéro, il n'y a plus de plafond.</div>` : ''}
    <div style="margin-top:8px">${COMPARTMENT_INFO.map((c) => `
      <div class="comp">
        <div class="comp-head"><h3>${c.name}</h3><b class="num">${Math.round(sim[c.key] * 100)} %</b></div>
        <div class="bar"><i style="width:${(sim[c.key] * 100).toFixed(1)}%"></i></div>
        <p>${c.now} ${c.image}</p>
        ${source(c.source)}${c.source2 ? `<br>${source(c.source2)}` : ''}
      </div>`).join('')}</div>
    <div class="comp"><p>L'image reste un symbole. Dans la réalité, une partie des dépôts ne part jamais complètement. Ce qui récupère vraiment, ce sont les cils, l'inflammation, le souffle et le risque.</p></div>
  `);
}

// --- Et si je tiens ? ---
const FUTURE_STOPS = [
  { label: 'Aujourd\'hui', days: 0 },
  { label: 'Dans 1 jour', days: 1 },
  { label: 'Dans 1 semaine', days: 7 },
  { label: 'Dans 1 mois', days: 30 },
  { label: 'Dans 3 mois', days: 90 },
  { label: 'Dans 1 an', days: 365 },
  { label: 'Dans 3 ans', days: 1095 },
  { label: 'Dans 10 ans', days: 3650 },
];

function futureHtml() {
  return `<div class="panel">
    <div class="future-head"><div class="future-when" data-live="future-when"></div><div class="future-pct num" data-live="future-pct"></div></div>
    <input class="slider" type="range" min="0" max="${FUTURE_STOPS.length - 1}" step="1" value="${ui.futureIndex}" data-input="future" aria-label="Choisir le moment">
    <p class="future-note" data-live="future-note"></p>
    <div class="actions"><button class="btn btn-soft" data-act="future-close">Revenir à aujourd'hui</button></div>
  </div>`;
}

function updateFuture() {
  const stop = FUTURE_STOPS[ui.futureIndex];
  // On suppose que plus aucune cigarette n'est fumée à partir de maintenant.
  const at = Date.now() + stop.days * DAY;
  const sim = currentSim(at);
  if (lungs) lungs.setState(visual(sim));
  const m = money(S.profile, cigTimes(), at);
  const reached = [...MILESTONES].reverse().find((x) => sim.cleanDays >= x.at);
  setLive('future-when', stop.label);
  setLive('future-pct', `${Math.round(sim.score * 100)} %`);
  setLive('future-note', `${eur0(m.saved)} gardés${reached ? `. ${reached.title}.` : '.'} Si tu ne refumes plus à partir de maintenant.`);
}

// --- Envie ---
function startSos(seconds = SOS_SECONDS) {
  closeSheet();
  ui.tab = 'poumons';
  ui.mode = 'sos';
  ui.sosPane = 'respire';
  ui.sosStart = Date.now();
  ui.sosLength = seconds;
  const t0 = performance.now() / 1000;
  if (lungs) {
    lungs.setGuide((t) => {
      const c = (t - t0) % 10;
      return c < 4 ? Math.sin((c / 4) * Math.PI / 2) ** 2 : Math.cos(((c - 4) / 6) * Math.PI / 2) ** 2;
    });
  }
  render();
}

function endSos() {
  ui.mode = 'home';
  if (lungs) lungs.setGuide(null);
}

function sosHtml() {
  return `<div class="panel">
    <div class="sos-breath">
      <div class="sos-word" data-live="sos-word">Inspire</div>
      <div class="sos-note">Suis tes poumons.</div>
    </div>
    <div class="seg" role="group" aria-label="Que faire">
      ${[['respire', 'Respirer'], ['bouge', 'Bouger'], ['plan', 'Mon plan'], ['appel', 'Appeler']].map(([id, l]) => `<button data-act="sos-pane" data-x="${id}" aria-pressed="${ui.sosPane === id}">${l}</button>`).join('')}
    </div>
    <div class="sos-pane">${sosPane()}</div>
    <div class="actions">
      <button class="btn btn-main" data-act="sos-win">C'est passé, j'ai tenu</button>
      <button class="btn btn-text" data-act="sos-fail">Je vais en fumer une</button>
    </div>
  </div>`;
}

function sosPane() {
  if (ui.sosPane === 'bouge') {
    return `<strong>${esc(MOVES[Math.floor(Date.now() / 60000) % MOVES.length])}</strong><br>Une séance d'exercice réduit l'envie jusqu'à 30 minutes après. ${source('singh')}`;
  }
  if (ui.sosPane === 'plan') {
    const plans = S.plans.map((p) => `<li><strong>Si ${esc(p.when)}</strong>, alors ${esc(p.then)}.</li>`).join('');
    const note = S.note ? `<div class="quote" style="margin:0 0 10px">${esc(S.note)}</div>` : '';
    return `${note}<ul>${plans}</ul>`;
  }
  if (ui.sosPane === 'appel') {
    return `<strong>Tabacstop : 0800 111 00, gratuit.</strong> Lundi au vendredi, 15 h à 19 h. Des tabacologues, sans jugement.<br><a class="btn btn-soft" style="margin-top:8px;min-height:44px" href="tel:${TEL}">Appeler</a>`;
  }
  return `Inspire 4 secondes, expire 6. Les respirations profondes baissent l'envie et la tension. ${source('mcclernon')}`;
}

function sosWin() {
  const win = { t: Date.now(), trigger: null };
  S.wins.push(win);
  persist();
  endSos();
  render();
  if (lungs) lungs.puffAir();
  const perCig = money(S.profile, cigTimes(), Date.now()).perCig;
  openTriggerSheet(`Envie battue`, `C'est ta ${ordinal(S.wins.length)}. Cette clope t'aurait coûté ${eur(perCig)}, et elle n'aurait calmé que le manque qu'elle a créé.`, (id) => { win.trigger = id; persist(); });
}

const ordinal = (n) => (n === 1 ? '1re' : `${n}e`);

// --- Cigarette ---
function openSmokeSheet() {
  const left = remaining();
  const holding = ui.mode === 'sos';
  openSheet(`
    <h2 class="title">${left === 1 ? 'La dernière ?' : 'Tu vas en fumer une ?'}</h2>
    <p>${holding ? 'Tu as déjà commencé à tenir, et chaque minute compte.' : 'Attendre 5 minutes ne t\'engage à rien.'} Si tu la fumes quand même, note-la : l'appli compte juste, sans te juger.</p>
    <div class="actions">
      <button class="btn btn-main" data-act="${holding ? 'close' : 'sos'}">${holding ? 'Je continue à tenir' : 'Tenir 5 minutes d\'abord'}</button>
      ${holdButton('confirm-smoke', 'Maintiens pour la noter')}
    </div>`);
}

const holdButton = (act, label, cls = 'btn-soft') => `<button class="btn ${cls} hold" data-hold="${act}"><i class="hold-fill"></i><span>${label}</span></button>`;

function addCigarette() {
  const before = remaining();
  const wasFree = before === 0;
  const entry = { t: Date.now(), trigger: null, outOfPack: wasFree };
  S.cigs.push(entry);
  persist();
  closeSheet();
  ui.tab = 'poumons';
  if (ui.mode === 'sos') endSos();
  ui.mode = 'home';
  render();
  refreshLungs();
  if (lungs) lungs.puffSmoke();
  let followUp = null;
  toast('Cigarette notée.', 'Annuler', () => {
    clearTimeout(followUp);
    S.cigs = S.cigs.filter((c) => c !== entry);
    persist();
    closeSheet();
    render();
    refreshLungs();
  });
  const onPick = (id) => { entry.trigger = id; persist(); };
  // La feuille attend que la fumée ait traversé les poumons
  if (!wasFree && before === 1) {
    followUp = setTimeout(() => openSheet(`
      <h2 class="title">C'était la dernière.</h2>
      <p>Ton compteur part de maintenant. Dans 12 heures, le monoxyde de carbone aura quitté ton sang.</p>
      <p>Là, tout de suite : jette le paquet, le briquet et le cendrier. Chaque geste rend la prochaine envie plus simple à passer.</p>
      <div class="actions"><button class="btn btn-main" data-act="close">C'est fait</button></div>`), 1700);
  } else if (wasFree) {
    const cost = 1 + 0.03 * simulate(S.profile, cigTimes().filter((t) => t !== entry.t), entry.t).cleanDays;
    followUp = setTimeout(() => openTriggerSheet('Un écart, pas un retour à zéro',
      `Tes paliers reculent d'environ ${Math.max(1, Math.round(cost))} ${Math.round(cost) > 1 ? 'jours' : 'jour'}. Le reste tient. Un écart ne mène pas forcément à la rechute : ce qui compte pour la suite, c'est de rester sûr que tu peux tenir. La seule question utile : qu'est-ce qui l'a déclenchée ?`,
      onPick, 'kirchner'), 1700);
  } else {
    const left = remaining();
    followUp = setTimeout(() => openTriggerSheet(`Il en reste ${left}`, `Le monoxyde de carbone remonte un moment, puis il repart en quelques heures. D'où venait celle-là ?`, onPick), 1700);
  }
}

function openTriggerSheet(title, text, onPick, src) {
  openSheet(`
    <h2 class="title">${title}</h2>
    <p>${text}</p>
    ${src ? source(src) : ''}
    <div class="chips">${TRIGGERS.map((t) => `<button class="chip" data-act="pick-trigger" data-x="${t.id}">${t.label}</button>`).join('')}</div>
    <div class="actions"><button class="btn btn-text" data-act="close">Passer</button></div>`);
  pendingTrigger = onPick;
}
let pendingTrigger = null;

// --- Argent ---
function moneyHtml() {
  const m = money(S.profile, cigTimes(), Date.now());
  const goal = S.goal && S.goal.price > 0 ? S.goal : null;
  const goalPct = goal ? Math.min(1, m.saved / goal.price) : 0;
  const goalDays = goal && m.saved < goal.price ? Math.ceil((goal.price - m.saved) / m.perDay) : 0;
  return `
    <h1 class="title">Ton argent</h1>
    <div class="big-money num" data-live="saved-big">0 €</div>
    <p class="lede">gardés depuis le départ, par rapport à ${S.profile.perDay} clopes par jour.</p>

    <section>
      <div class="card">
        <h3>${goal ? esc(goal.name) : 'Donne un nom à cet argent'}</h3>
        ${goal
          ? `<div class="bar"><i style="width:${(goalPct * 100).toFixed(1)}%"></i></div>
             <p class="num">${eur(Math.min(m.saved, goal.price))} sur ${eur(goal.price)}${goalDays ? `. Encore ${goalDays} ${goalDays > 1 ? 'jours' : 'jour'} sans fumer.` : '. Atteint.'}</p>`
          : `<p>Un loyer, une facture, un vrai achat. Un objectif précis pèse plus lourd qu'un total abstrait.</p>`}
        <button class="btn btn-soft" data-act="goal">${goal ? 'Changer l\'objectif' : 'Choisir un objectif'}</button>
      </div>
    </section>

    <section>
      <h2 class="section-title">Si tu tiens</h2>
      <div class="rows">
        ${[['Chaque jour', m.perDay], ['1 mois', m.perDay * 30.44], ['1 an', m.perDay * 365.25], ['5 ans', m.perDay * 1826], ['10 ans', m.perDay * 3652.5]].map(([l, v]) => `<div class="row"><span>${l}</span><b class="num">${v < 100 ? eur(v) : eur0(v)}</b></div>`).join('')}
      </div>
    </section>

    <section>
      <h2 class="section-title">Ce qui est déjà parti</h2>
      <div class="rows">
        <div class="row"><span>${S.profile.years} ans de clopes, au prix d'aujourd'hui</span><b class="num">≈ ${eur0(m.burned)}</b></div>
        <div class="row"><span>Une clope</span><b class="num">${eur(m.perCig)}</b></div>
        <div class="row"><span>Depuis le départ, ${S.cigs.length} ${S.cigs.length > 1 ? 'clopes fumées' : 'clope fumée'}</span><b class="num">${eur(m.spentSince)}</b></div>
      </div>
      <p class="lede" style="font-size:14px">Le total est un ordre de grandeur : le paquet coûtait moins cher il y a 10 ans.</p>
    </section>

    <section>
      <div class="card"><h3>Rends-le réel</h3><p>Cet argent n'existe que s'il sort de ton compte courant. Tous les 2 jours, vire ${eur(S.profile.packPrice)} sur un compte à part : le prix du paquet que tu n'achètes pas.</p></div>
    </section>`;
}

function openGoal() {
  const g = S.goal || {};
  openSheet(`
    <h2 class="title">Cet argent, c'est pour quoi ?</h2>
    <form data-form="goal">
      <label class="field"><span>Objectif</span><input name="name" maxlength="50" value="${esc(g.name || '')}" required></label>
      <label class="field"><span>Montant en euros</span><input name="price" type="number" inputmode="decimal" min="1" step="any" value="${g.price || ''}" required></label>
      <div class="actions"><button class="btn btn-main" type="submit">Enregistrer</button></div>
    </form>`);
}

// --- Parcours ---
function journeyHtml() {
  const sim = currentSim();
  const now = Date.now();
  const left = remaining();
  const day = quitDay();
  let header;
  if (left > 0) {
    header = `<h1 class="title">${left === 1 ? 'Plus qu\'une clope' : `Plus que ${left} clopes`} avant ton Jour 0</h1>
      <p class="lede">Le dernier paquet est aussi une préparation.</p>
      <section><div class="card"><h3>À faire avant la dernière</h3>
        <p>Ne rachète rien en « réserve ». Écris tes plans si-alors dans Aide. Préviens une personne. Passe en pharmacie demander ce qui existe : ça se prépare avant le manque, pas pendant.</p>
        ${holdButton('discard', 'Maintiens pour jeter le reste maintenant')}
      </div></section>`;
  } else {
    const card = day <= 8 ? FIRST_DAYS[day] : null;
    const week = eur(money(S.profile, [], S.profile.start + 7 * DAY).saved);
    header = `<h1 class="title">Jour ${day}</h1>
      ${card ? `<section style="margin-top:14px"><div class="card"><h3>${card.title}</h3><p>${card.text.replace('{semaine}', week)}</p>${day <= 8 ? source('hughes') : ''}</div></section>` : `<p class="lede">Les envies s'espacent. Quand elles reviennent, elles passent de la même façon.</p>`}`;
  }
  const days = dailyCounts(cigTimes(), now, 14);
  const maxV = Math.max(S.profile.perDay, ...days.map((d) => d.count));
  const counts = {};
  [...S.cigs, ...S.wins].forEach((e) => { if (e.trigger) counts[e.trigger] = (counts[e.trigger] || 0) + 1; });
  const topTriggers = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const firstNext = nextMilestone(sim);
  const events = [
    ...S.cigs.map((c) => ({ ...c, kind: 'cig', ref: c })),
    ...S.wins.map((w) => ({ ...w, kind: 'win', ref: w })),
  ].sort((a, b) => b.t - a.t).slice(0, 15);

  return `
    ${header}
    <section>
      <h2 class="section-title">Tes clopes, jour par jour</h2>
      <div class="chart" role="img" aria-label="Cigarettes par jour sur 14 jours, ton habitude étant de ${S.profile.perDay}">
        <div class="base" style="bottom:${(S.profile.perDay / maxV) * 84}%"><span>avant : ${S.profile.perDay}</span></div>
        ${days.map((d) => `<div class="day ${d.count ? '' : 'zero'}"><i style="height:${(d.count / maxV) * 84}%"></i>${d.count ? `<em class="num" style="bottom:calc(${(d.count / maxV) * 84}% + 1px)">${d.count}</em>` : ''}</div>`).join('')}
      </div>
      <div class="chart-axis"><span>il y a 13 jours</span><span>aujourd'hui</span></div>
      ${topTriggers.length ? `<div class="rows" style="margin-top:12px">${topTriggers.map(([id, n]) => `<div class="row"><span>${trigName(id)}</span><b class="num">${n}</b></div>`).join('')}</div>` : ''}
    </section>

    <section>
      <h2 class="section-title">Tes paliers</h2>
      <p class="lede" style="margin:-4px 0 14px;font-size:14px">Un écart recule ces paliers d'environ un jour, il ne les efface pas. ${left > 0 ? 'Ils démarrent vraiment après ta dernière clope.' : ''}</p>
      <ol class="timeline">
        ${MILESTONES.map((m) => {
          const done = sim.cleanDays >= m.at;
          const isNext = m === firstNext;
          return `<li class="mile ${done ? 'done' : ''} ${isNext ? 'next' : ''}">
            <small class="num">${m.label}${isNext ? ` · dans ${until(m.at - sim.cleanDays)}` : ''}</small>
            <h3>${m.title}</h3>
            ${done || isNext ? `<p>${m.text}</p>${source(m.source)}` : ''}
          </li>`;
        }).join('')}
      </ol>
    </section>

    <section>
      <h2 class="section-title">Ton journal</h2>
      ${events.length ? `<div>${events.map((e) => `<div class="event"><div>${e.kind === 'cig' ? 'Clope fumée' : 'Envie battue'} <span>${e.trigger ? `· ${trigName(e.trigger)}` : ''}</span><br><span class="num" style="font-size:13px">${clock(e.t)}</span></div><button data-act="del-event" data-x="${e.kind}" data-t="${e.t}">Retirer</button></div>`).join('')}</div>` : '<p class="empty">Rien pour l\'instant.</p>'}
    </section>`;
}

// --- Aide ---
function helpHtml() {
  const installed = isStandalone();
  return `
    <h1 class="title">Aide</h1>
    <section style="margin-top:16px">
      ${installed ? '' : `<div class="card"><h3>Pas encore sur ton écran d'accueil</h3><p>Dans Safari : Partager, puis « Sur l'écran d'accueil ». Sans ça, iOS peut effacer tes données après quelques jours sans visite.</p></div>`}
      <div class="card">
        <h3>Tu veux racheter un paquet</h3>
        <p>Le moment le plus dangereux. Ouvre ça avant de sortir.</p>
        <button class="btn btn-main" data-act="gate">J'y pense, là</button>
      </div>
      <div class="card">
        <h3>Tabacstop : 0800 111 00</h3>
        <p>Gratuit. 8 séances de coaching par téléphone avec un tabacologue. Lundi au vendredi, 15 h à 19 h.</p>
        ${source('tabacstop')}
        <a class="btn btn-soft" href="tel:${TEL}">Appeler</a>
      </div>
    </section>

    <section>
      <h2 class="section-title">La vérité sur tes chances</h2>
      <div class="card">
        <p>Sans aucune aide, 3 à 5 % des tentatives tiennent 6 à 12 mois. Ce n'est pas un manque de volonté : c'est la nicotine. La plupart des rechutes arrivent dans les 8 premiers jours.</p>
        ${source('hughes')}
      </div>
      <div class="card">
        <h3>Ce qui change vraiment les chiffres</h3>
        <p>Les patchs avec une forme rapide (gomme, pastille) et la varénicline augmentent nettement les chances. Pour 10 personnes qui arrêtent avec un patch seul, environ 15 avec la varénicline. Les substituts se vendent sans ordonnance : demande à ton pharmacien lequel, ou à ton médecin pour la varénicline.</p>
        ${source('cochraneMeds')}
        <p style="margin-top:10px">Et le plus simple : écrire tes plans « si… alors… ».</p>
        ${source('mcwilliams')}
      </div>
    </section>

    <section>
      <h2 class="section-title">« Mais ça me détend »</h2>
      <div class="card">
        <p>La clope calme surtout le manque de la clope d'avant. Le stress du business, lui, reste là. Les études qui comparent montrent moins d'anxiété et de stress chez ceux qui ont arrêté depuis au moins 6 semaines que chez ceux qui continuent.</p>
        <p style="margin-top:10px">Les premiers jours, attends-toi au contraire : le manque ressemble à du stress. Ça passe.</p>
        ${source('cochraneMental')}<br>${source('taylor14')}
      </div>
    </section>

    <section>
      <h2 class="section-title">Réduire ou arrêter</h2>
      <div class="card">
        <p>Diminuer fait bouger tes poumons ici, mais peu : chez les hommes, même 1 clope par jour garde environ la moitié de l'excès de risque cardiaque de 20 par jour. L'appli récompense chaque baisse, et seul zéro enlève le plafond.</p>
        ${source('hackshaw')}
      </div>
    </section>

    <section>
      <h2 class="section-title">Pourquoi tu fais ça</h2>
      ${S.reasons ? `<div class="quote" style="margin-top:0">${esc(S.reasons)}</div>` : '<p class="empty">Rien d\'écrit pour l\'instant.</p>'}
      ${S.note ? `<p class="lede" style="margin-top:14px;font-size:14px">Ton message pour les moments durs :</p><div class="quote" style="margin-top:6px">${esc(S.note)}</div>` : ''}
      <button class="link" data-act="edit-why">Modifier</button>
    </section>

    <section>
      <h2 class="section-title">Tes plans si-alors</h2>
      <div>${S.plans.map((p) => `<div class="plan"><b>Si ${esc(p.when)}</b><br><span>alors ${esc(p.then)}.</span></div>`).join('')}</div>
      <button class="link" data-act="edit-plans">Modifier</button>
    </section>

    <section>
      <h2 class="section-title">Tes données</h2>
      <p class="lede" style="margin:0 0 6px;font-size:14px">Elles restent dans ce téléphone, rien n'est envoyé. Fais une sauvegarde de temps en temps.</p>
      <div class="actions">
        <button class="btn btn-soft" data-act="export">Sauvegarder dans un fichier</button>
        <label class="btn btn-soft">Restaurer une sauvegarde<input type="file" accept="application/json,.json" data-input="import" hidden></label>
        <button class="btn btn-soft" data-act="settings">Changer mes chiffres</button>
      </div>
    </section>

    <section>
      <h2 class="section-title">Sources</h2>
      <p class="lede" style="margin:0 0 10px;font-size:14px">Les délais et les chiffres viennent de ces études. Le pourcentage et l'image sont une estimation construite dessus, pas une mesure. Le poids de chaque partie et la pénalité d'une cigarette sont mes choix de calcul.</p>
      ${Object.values(SOURCES).map((s) => `<div class="event" style="display:block"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a><br><span style="font-size:13.5px">${esc(s.says)}</span></div>`).join('')}
      <p class="lede" style="font-size:14px">Souffle ne remplace pas un médecin. Si tu as une toux qui dure, du sang en toussant ou un essoufflement inhabituel, va consulter.</p>
    </section>

    <section>${holdButton('reset', 'Maintiens pour tout effacer', 'btn-line')}</section>`;
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function openInstall() {
  openSheet(`
    <h2 class="title">Mets-la sur ton écran d'accueil</h2>
    <p>Dans Safari, touche le bouton Partager, puis « Sur l'écran d'accueil ». Elle s'ouvrira comme une vraie appli, même sans réseau.</p>
    <p>Fais-le maintenant : sans ça, iOS peut effacer tes données après quelques jours sans visite.</p>
    <div class="actions"><button class="btn btn-main" data-act="close">Compris</button></div>`);
}

function openGate() {
  S.gateOpens += 1;
  persist();
  const m = money(S.profile, cigTimes(), Date.now());
  const days = S.profile.packPrice / m.perDay;
  openSheet(`
    <h2 class="title">Avant de sortir</h2>
    <p>Un paquet, c'est ${eur(S.profile.packPrice)}, soit ${Math.round(days)} jours d'économies. Et surtout ${S.profile.packSize} clopes à portée de main à chaque envie.</p>
    ${S.note ? `<div class="quote">${esc(S.note)}</div>` : ''}
    ${S.reasons ? `<div class="quote">${esc(S.reasons)}</div>` : ''}
    <p>Donne-toi 10 minutes. Tu pourras toujours y aller après.</p>
    <div class="actions">
      <button class="btn btn-main" data-act="sos-long">Attendre 10 minutes</button>
      <a class="btn btn-soft" href="tel:${TEL}">Appeler Tabacstop</a>
    </div>
    <p style="font-size:14px">Déjà acheté ? Jette-le maintenant, même entamé. Ce n'est pas fini.</p>`);
}

function openWhy() {
  openSheet(`
    <h2 class="title">Pourquoi tu fais ça</h2>
    <form data-form="why">
      <label class="field"><span>Tes raisons, avec tes mots</span><textarea name="reasons" maxlength="600">${esc(S.reasons)}</textarea></label>
      <label class="field"><span>Un message à toi-même, pour le moment où ce sera dur</span><textarea name="note" maxlength="300">${esc(S.note)}</textarea></label>
      <div class="actions"><button class="btn btn-main" type="submit">Enregistrer</button></div>
    </form>`);
}

function plansFields() {
  return S.plans.map((p, i) => `
    <label class="field"><span>Si…</span><input name="when${i}" maxlength="120" value="${esc(p.when)}"></label>
    <label class="field"><span>alors…</span><textarea name="then${i}" maxlength="200">${esc(p.then)}</textarea></label>`).join('');
}

function openPlans() {
  openSheet(`
    <h2 class="title">Tes plans si-alors</h2>
    <p>Décider à l'avance évite de décider en plein manque.</p> ${source('mcwilliams')}
    <form data-form="plans">${plansFields()}<div class="actions"><button class="btn btn-main" type="submit">Enregistrer</button></div></form>`);
}

function profileFields(p, withLeft) {
  return `
    <div class="grid2">
      <label class="field"><span>Clopes par jour</span><input name="perDay" type="number" inputmode="numeric" min="1" max="100" value="${p.perDay}" required></label>
      <label class="field"><span>Années à fumer</span><input name="years" type="number" inputmode="numeric" min="0" max="80" value="${p.years}" required></label>
      <label class="field"><span>Prix du paquet (€)</span><input name="packPrice" type="number" inputmode="decimal" step="0.01" min="0.5" value="${p.packPrice}" required></label>
      <label class="field"><span>Clopes par paquet</span><input name="packSize" type="number" inputmode="numeric" min="1" max="60" value="${p.packSize}" required></label>
    </div>
    ${withLeft ? `<label class="field"><span>Clopes qu'il te reste, là, maintenant</span><input name="left" type="number" inputmode="numeric" min="0" max="60" value="${withLeft.value}" required></label>` : ''}`;
}

function openSettings() {
  openSheet(`
    <h2 class="title">Tes chiffres</h2>
    <form data-form="settings">${profileFields(S.profile, { value: remaining() })}
      <div class="actions"><button class="btn btn-main" type="submit">Enregistrer</button></div>
    </form>`);
}

// --- Démarrage ---
function renderOnboarding() {
  tabs.style.display = 'none';
  stage.hidden = ui.step !== 1;
  stage.classList.add('onboard-stage');
  overlay.innerHTML = '';
  content.className = 'content page onboard';
  if (ui.step === 1) {
    content.style.paddingTop = '10px';
    content.innerHTML = `
      <div class="steps">1 sur 3</div>
      <h1 class="title">Voilà d'où tu pars.</h1>
      <p class="lede">Une image symbolique, pas une radio. Elle va changer avec toi, à partir de vraies études.</p>
      <form data-form="start1">
        ${profileFields(DEFAULT_PROFILE, { value: DEFAULT_PROFILE.packStart })}
        <button class="btn btn-main" type="submit">Continuer</button>
      </form>`;
  } else if (ui.step === 2) {
    content.style.paddingTop = '';
    content.innerHTML = `
      <div class="steps">2 sur 3</div>
      <h1 class="title">Pourquoi tu arrêtes ?</h1>
      <p class="lede">Ces phrases reviendront quand ce sera dur. Écris-les comme tu te parles.</p>
      <form data-form="start2">
        <label class="field"><span>Tes raisons</span><textarea name="reasons" maxlength="600" placeholder="Ce que ça change pour toi, concrètement" required>${esc(S.reasons)}</textarea></label>
        <label class="field"><span>Un message à toi-même, pour le moment où tu voudras racheter un paquet</span><textarea name="note" maxlength="300">${esc(S.note)}</textarea></label>
        <button class="btn btn-main" type="submit">Continuer</button>
      </form>`;
  } else {
    content.innerHTML = `
      <div class="steps">3 sur 3</div>
      <h1 class="title">Décide maintenant, pas en plein manque.</h1>
      <p class="lede">Des plans écrits à l'avance font à peu près doubler les arrêts dans les études. Ajuste ceux-là à ta vie.</p>
      ${source('mcwilliams')}
      <form data-form="start3">${plansFields()}<button class="btn btn-main" type="submit">C'est parti</button></form>`;
  }
  content.scrollTop = 0;
  if (lungs && ui.step === 1) { lungs.start(); requestAnimationFrame(() => lungs.resize()); }
  if (lungs && ui.step !== 1) lungs.stop();
}

// --- Mise à jour à la seconde ---
function setLive(name, text) {
  document.querySelectorAll(`[data-live="${name}"]`).forEach((el) => {
    if (el.textContent !== text) el.textContent = text;
  });
}

function tick() {
  if (!S.profile) return;
  const now = Date.now();
  if (!lastSim) lastSim = currentSim(now);
  setLive('since', duration(now - lastSmoke()));
  const m = money(S.profile, cigTimes(), now);
  setLive('saved', eur(m.saved));
  setLive('saved-big', eur(m.saved));
  setLive('score', String(Math.round(lastSim.score * 100)));
  const next = nextMilestone(lastSim);
  document.querySelectorAll('[data-live="next"]').forEach((el) => {
    const html = next
      ? `Prochain palier : <strong>${next.title}</strong>, dans ${until(next.at - lastSim.cleanDays)}`
      : 'Tous les paliers sont franchis.';
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  });
  if (ui.mode === 'sos') {
    const left = ui.sosLength - Math.floor((now - ui.sosStart) / 1000);
    setLive('sos-timer', left > 0 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : 'Tenu');
  }
  if (ui.mode === 'future') updateFuture();
}

function breathWord() {
  if (ui.mode !== 'sos') return;
  const c = ((Date.now() - ui.sosStart) / 1000) % 10;
  setLive('sos-word', c < 4 ? 'Inspire' : 'Expire');
}

// --- Feuilles et messages ---
const sheetRoot = document.getElementById('sheet-root');
let sheetEl = null;

function openSheet(html) {
  closeSheet(true);
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet-wrap';
  sheetEl.innerHTML = `<div class="sheet-back" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"><button class="sheet-close" data-act="close" aria-label="Fermer">×</button>${html}</div>`;
  sheetRoot.append(sheetEl);
  void sheetEl.offsetHeight; // fixe la position de départ avant de lancer la transition
  sheetEl.classList.add('in');
}

function closeSheet(instant) {
  if (!sheetEl) return;
  const el = sheetEl;
  sheetEl = null;
  pendingTrigger = null;
  if (instant) { el.remove(); return; }
  el.classList.remove('in');
  setTimeout(() => el.remove(), 300);
}

function toast(text, actionLabel, onAction) {
  const rootEl = document.getElementById('toast-root');
  rootEl.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(text)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  rootEl.append(el);
  void el.offsetHeight;
  el.classList.add('in');
  const remove = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 240); };
  if (actionLabel) el.querySelector('button').addEventListener('click', () => { remove(); onAction(); });
  setTimeout(remove, 6000);
}

// --- Actions ---
const ACTIONS = {
  tab(x) { ui.tab = x; if (ui.mode === 'sos') endSos(); ui.mode = 'home'; refreshLungs(); render(); },
  details: openDetails,
  future() { ui.mode = 'future'; ui.futureIndex = 3; render(); },
  'future-close'() { ui.mode = 'home'; render(); refreshLungs(); },
  sos() { startSos(); },
  'sos-long'() { startSos(GATE_SECONDS); },
  'sos-pane'(x) { ui.sosPane = x; content.innerHTML = sosHtml(); tick(); },
  'sos-win': sosWin,
  'sos-fail'() { openSmokeSheet(); },
  smoke: openSmokeSheet,
  close() { closeSheet(); },
  'pick-trigger'(x) { if (pendingTrigger) pendingTrigger(x); closeSheet(); },
  goal: openGoal,
  gate: openGate,
  'edit-why': openWhy,
  'edit-plans': openPlans,
  settings: openSettings,
  export() { exportFile(S); },
  'del-event'(x, el) {
    const t = Number(el.dataset.t);
    if (x === 'cig') S.cigs = S.cigs.filter((c) => c.t !== t);
    else S.wins = S.wins.filter((w) => w.t !== t);
    persist();
    refreshLungs();
    render();
  },
};

const HOLD_ACTIONS = {
  'confirm-smoke': addCigarette,
  discard() {
    S.profile.packDiscardedAt = Date.now();
    persist();
    refreshLungs();
    ui.tab = 'poumons';
    render();
    openSheet(`<h2 class="title">C'est fini, le paquet.</h2><p>Tu viens de t'épargner ce qu'il restait dedans. Jette aussi le briquet. Le compteur tourne depuis ta dernière clope.</p><div class="actions"><button class="btn btn-main" data-act="close">C'est fait</button></div>`);
  },
  reset() {
    S = freshState();
    persist();
    ui.step = 1;
    ui.tab = 'poumons';
    ui.mode = 'home';
    lastSim = null;
    if (lungs) lungs.setState(visual({ co: 0, souffle: 0, cils: 0, cellules: 0, score: 0 }), { instant: true });
    location.reload();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el) {
    const fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset.x, el); }
    return;
  }
  if (e.target === document.getElementById('lungs') && ui.tab === 'poumons' && ui.mode === 'home' && S.profile) openDetails();
  // Au clavier, un maintien n'a pas de sens : la touche Entrée vaut confirmation.
  const hold = e.target.closest('[data-hold]');
  if (hold && e.detail === 0) HOLD_ACTIONS[hold.dataset.hold]();
});

// Maintien pour confirmer
let holdTimer = null;
let holdEl = null;
const HOLD_MS = 1200;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hold]');
  if (!el) return;
  holdEl = el;
  el.classList.add('pressing');
  holdTimer = setTimeout(() => {
    el.classList.remove('pressing');
    holdEl = null;
    HOLD_ACTIONS[el.dataset.hold]();
  }, HOLD_MS);
});
['pointerup', 'pointercancel'].forEach((name) => document.addEventListener(name, () => {
  if (!holdEl) return;
  clearTimeout(holdTimer);
  holdEl.classList.remove('pressing');
  holdEl = null;
}, true));
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-hold]')) e.preventDefault(); });

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'future') {
    ui.futureIndex = Number(e.target.value);
    updateFuture();
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.dataset.input !== 'import') return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    S = parseImport(await file.text());
    persist();
    lastSim = null;
    refreshLungs({ instant: true });
    ui.tab = 'poumons';
    render();
    toast('Sauvegarde restaurée.');
  } catch (err) {
    toast(err.message || 'Fichier illisible.');
  }
});

function readProfile(data, base) {
  return {
    ...base,
    perDay: Number(data.get('perDay')),
    years: Number(data.get('years')),
    packPrice: Number(data.get('packPrice')),
    packSize: Number(data.get('packSize')),
  };
}

function readPlans(data) {
  S.plans = S.plans.map((p, i) => ({ ...p, when: String(data.get(`when${i}`) || p.when).trim(), then: String(data.get(`then${i}`) || p.then).trim() }));
}

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = new FormData(form);
  const kind = form.dataset.form;
  if (kind === 'start1') {
    const left = Number(data.get('left'));
    S.profile = readProfile(data, { start: Date.now(), packStart: left });
    // Tant que le démarrage n'est pas fini, on garde le profil de côté pour pouvoir reprendre.
    ui.draft = S.profile;
    S.profile = null;
    ui.step = 2;
    renderOnboarding();
  } else if (kind === 'start2') {
    S.reasons = String(data.get('reasons')).trim();
    S.note = String(data.get('note')).trim();
    ui.step = 3;
    renderOnboarding();
  } else if (kind === 'start3') {
    readPlans(data);
    S.profile = { ...ui.draft, start: Date.now() };
    persist();
    askPersistence();
    content.style.paddingTop = '';
    refreshLungs({ instant: true });
    render();
    if (!isStandalone()) openInstall();
  } else if (kind === 'goal') {
    S.goal = { name: String(data.get('name')).trim(), price: Number(data.get('price')) };
    persist();
    closeSheet();
    render();
  } else if (kind === 'why') {
    S.reasons = String(data.get('reasons')).trim();
    S.note = String(data.get('note')).trim();
    persist();
    closeSheet();
    render();
  } else if (kind === 'plans') {
    readPlans(data);
    persist();
    closeSheet();
    render();
  } else if (kind === 'settings') {
    S.profile = readProfile(data, S.profile);
    const used = cigTimes().filter((t) => t >= S.profile.start).length;
    const left = Number(data.get('left'));
    S.profile.packStart = used + left;
    delete S.profile.packDiscardedAt;
    persist();
    closeSheet();
    refreshLungs();
    render();
  }
});

// --- Lancement ---
async function boot() {
  const canvas = document.getElementById('lungs');
  const bottomWeighted = (w, h) => {
    const s = Math.min(w / 768, h / 844) * 1.02;
    return { cx: w / 2, cy: h / 2 + 4, s };
  };
  try {
    lungs = new Lungs(canvas, { fit: bottomWeighted });
    lungs.setState(visual(S.profile ? currentSim() : { co: 0, souffle: 0, cils: 0, cellules: 0, score: 0 }), { instant: true });
    const ok = await lungs.init('assets/');
    if (!ok) throw new Error('WebGL absent');
  } catch (err) {
    console.warn(err);
    lungs = null;
    const img = document.createElement('img');
    img.src = 'assets/icon-512.png';
    img.alt = '';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain';
    canvas.replaceWith(img);
  }
  render();
  setInterval(tick, 1000);
  setInterval(breathWord, 200);
  setInterval(() => refreshLungs(), 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { refreshLungs(); tick(); }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
