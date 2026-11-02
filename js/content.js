// Tous les textes appuyés sur une étude, avec leur source. Rien ici n'est inventé :
// si un chiffre change, il change ici et dans les constantes de model.js.

export const SOURCES = {
  who: {
    label: 'OMS (2020). Bienfaits de l\'arrêt du tabac',
    url: 'https://www.who.int/news-room/q-a-detail/health-benefits-of-smoking-cessation',
    says: 'La chronologie de référence : 20 min, 12 h, 2-12 semaines, 1-9 mois, 1 an, 5-15 ans, 10 ans, 15 ans. Près de 10 ans de vie gagnés en arrêtant vers 30 ans.',
  },
  jha: {
    label: 'Jha et coll., NEJM Evidence (2024). 1,5 million d\'adultes dans 4 pays',
    url: 'https://temertymedicine.utoronto.ca/news/quitting-smoking-any-age-brings-big-health-benefits-fast-study',
    says: 'Arrêter avant 40 ans permet de vivre presque aussi longtemps qu\'un non-fumeur. Environ 10 ans après l\'arrêt, la survie est proche de celle d\'un non-fumeur ; la moitié de ce bénéfice arrive en 3 ans. Étude d\'observation.',
  },
  yoshida: {
    label: 'Yoshida et coll., Nature (2020)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31996850/',
    says: 'Les anciens fumeurs ont environ 4 fois plus de cellules bronchiques quasi intactes que les fumeurs actuels. 16 personnes seulement : ça montre un renouvellement, pas directement une baisse du risque.',
  },
  utiyama: {
    label: 'Utiyama et coll., Clinics (2016)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4930664',
    says: 'Le nettoyage du mucus par les cils (mesuré dans le nez) s\'améliore chez environ 63 % des ex-fumeurs à 1 mois et 85 % à 12 mois. Petit effectif : 20 ex-fumeurs.',
  },
  ramos: {
    label: 'Ramos et coll., Respirology (2011)',
    url: 'https://repositorio.unesp.br/handle/11449/7026',
    says: 'Amélioration du nettoyage mucociliaire nasal mesurable à partir du 15e jour, maintenue à 180 jours. 33 fumeurs.',
  },
  lhs: {
    label: 'Lung Health Study',
    url: 'https://www.ipcrg.org/node/705',
    says: 'Gain de 47 ml (2 %) de souffle mesuré la première année après l\'arrêt, chez des personnes atteintes d\'une BPCO légère à modérée. Le gain chez un jeune de 26 ans sans BPCO n\'a pas été mesuré ici.',
  },
  hughes: {
    label: 'Hughes et coll., Addiction (2004)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/14678060/',
    says: 'Sans aucune aide, 3 à 5 % des tentatives tiennent 6 à 12 mois. La plupart des rechutes arrivent dans les 8 premiers jours.',
  },
  cochraneMental: {
    label: 'Taylor et coll., Cochrane (2021). 102 études, 169 500 personnes',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33687070/',
    says: 'Après au moins 6 semaines sans fumer : moins de dépression, d\'anxiété et de stress que ceux qui continuent. Certitude faible à modérée (études d\'observation).',
  },
  taylor14: {
    label: 'Taylor et coll., BMJ (2014). 26 études',
    url: 'https://www.bmj.com/content/348/bmj.g1151',
    says: 'Arrêter est associé à moins d\'anxiété et de stress et à une meilleure humeur, avec un effet comparable à celui d\'un antidépresseur selon les auteurs. Étude d\'observation.',
  },
  hackshaw: {
    label: 'Hackshaw et coll., BMJ (2018). 141 études',
    url: 'https://www.bmj.com/content/360/bmj.j5855',
    says: '1 cigarette par jour porte déjà environ 46 % (hommes) de l\'excès de risque coronarien de 20 par jour. Les auteurs concluent : arrêter plutôt que réduire.',
  },
  singh: {
    label: 'Singh et coll., méta-analyse (2026). 59 essais',
    url: 'https://www.news-medical.net/news/20260703/Move-to-quit-Exercise-boosts-smoking-quit-rates.aspx',
    says: 'Une séance d\'exercice réduit l\'envie jusqu\'à 30 minutes après. Un complément, pas un remplacement des autres aides.',
  },
  mcclernon: {
    label: 'McClernon et coll., Addictive Behaviors (2004)',
    url: 'https://scholars.duke.edu/publication/697782',
    says: 'Des respirations profondes contrôlées réduisent l\'envie et la tension chez des fumeurs dépendants privés de cigarette. Étude préliminaire.',
  },
  mcwilliams: {
    label: 'McWilliams et coll., Health Psychology (2019)',
    url: 'https://eprints.whiterose.ac.uk/154864/',
    says: 'Écrire des plans « si… alors… » aide à arrêter : 10,7 % d\'arrêts contre 4,9 % sans plan en moyenne (rapport de cotes 1,70).',
  },
  kirchner: {
    label: 'Kirchner, Shiffman, Wileyto (2012)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3296289',
    says: 'La confiance en sa capacité à tenir prédit le passage d\'un écart au suivant. La culpabilité, elle, ne joue pas le rôle attendu. Le patch ralentit cette progression.',
  },
  cochraneMeds: {
    label: 'Cochrane : médicaments pour arrêter de fumer',
    url: 'https://www.cochrane.org/CD009329/TOBACCO_which-medicines-work-best-help-people-stop-smoking',
    says: 'Pour 10 personnes qui arrêtent avec un patch seul, environ 15 avec la varénicline. Patch + forme rapide (gomme, pastille) fait à peu près aussi bien que la varénicline.',
  },
  co: {
    label: 'WikEM : carboxyhémoglobine',
    url: 'https://www.wikem.org/wiki/Carboxyhemoglobin',
    says: 'Demi-vie d\'environ 5 h à l\'air libre.',
  },
  tabacstop: {
    label: 'Tabacstop, présenté par Solidaris (2024)',
    url: 'https://www.solidaris-brabant.be/sites/default/files/uploads/Publications/Flyer_Tabac_FR_2024.pdf',
    says: '0800 111 00, lundi au vendredi de 15 h à 19 h. 8 séances de coaching gratuites par téléphone avec un tabacologue. Horaires de 2024 : à revérifier.',
  },
};

// `at` : jours gagnés nécessaires. Un écart recule ce compteur, il ne l'efface pas.
export const MILESTONES = [
  { at: 20 / 1440, label: '20 minutes', title: 'Le cœur redescend', text: 'Le rythme cardiaque et la tension baissent.', source: 'who' },
  { at: 0.5, label: '12 heures', title: 'Le monoxyde de carbone est parti', text: 'Son taux dans le sang revient à la normale. Ton sang retransporte l\'oxygène.', source: 'who' },
  { at: 8, label: '8 jours', title: 'Le cap le plus dur est passé', text: 'La plupart des rechutes arrivent avant ce jour. Tu viens de le franchir.', source: 'hughes' },
  { at: 15, label: '15 jours', title: 'Les cils se remettent au travail', text: 'Le nettoyage du mucus commence à s\'améliorer de façon mesurable.', source: 'ramos' },
  { at: 30, label: '1 mois', title: 'Le nettoyage repart', text: 'Environ 6 ex-fumeurs sur 10 ont un nettoyage du mucus nettement meilleur à ce stade.', source: 'utiyama' },
  { at: 42, label: '6 semaines', title: 'Moins de stress qu\'en fumant', text: 'À partir d\'ici, les études comparent : moins d\'anxiété et de stress que ceux qui continuent.', source: 'cochraneMental' },
  { at: 84, label: '12 semaines', title: 'Le souffle revient', text: 'La circulation s\'améliore et la fonction pulmonaire augmente.', source: 'who' },
  { at: 270, label: '9 mois', title: 'Moins de toux, moins essoufflé', text: 'La toux et l\'essoufflement ont diminué.', source: 'who' },
  { at: 365, label: '1 an', title: 'Le risque cardiaque est divisé par deux', text: 'Le risque de maladie coronarienne est environ moitié moindre que celui d\'un fumeur.', source: 'who' },
  { at: 1095, label: '3 ans', title: 'La moitié du gain de survie est là', text: 'La moitié du bénéfice sur l\'espérance de vie arrive dans ces 3 premières années.', source: 'jha' },
  { at: 1825, label: '5 ans', title: 'Le risque d\'AVC se rapproche d\'un non-fumeur', text: 'Il l\'atteint entre 5 et 15 ans après l\'arrêt.', source: 'who' },
  { at: 3650, label: '10 ans', title: 'Le risque de cancer du poumon est divisé par deux', text: 'Et ta survie est proche de celle de quelqu\'un qui n\'a jamais fumé.', source: 'jha' },
  { at: 5475, label: '15 ans', title: 'Le cœur d\'un non-fumeur', text: 'Le risque de maladie coronarienne est celui d\'un non-fumeur.', source: 'who' },
];

export const COMPARTMENT_INFO = [
  {
    key: 'co', name: 'Oxygène', short: 'CO',
    now: 'Le monoxyde de carbone de la fumée prend la place de l\'oxygène sur tes globules rouges. Il part avec une demi-vie d\'environ 5 h.',
    source: 'who', image: 'Sur l\'image : le rose qui remonte dans le tissu.',
  },
  {
    key: 'souffle', name: 'Souffle', short: 'Souffle',
    now: 'Circulation et fonction pulmonaire remontent entre 2 et 12 semaines.',
    source: 'who', image: 'Sur l\'image : la respiration devient plus ample et plus lente.',
  },
  {
    key: 'cils', name: 'Cils et nettoyage', short: 'Cils',
    now: 'Les cils balaient le mucus et ce qu\'il retient. La fumée les paralyse. Ils reprennent en quelques semaines ; toux et essoufflement baissent sur 1 à 9 mois.',
    source: 'utiyama', source2: 'who', image: 'Sur l\'image : les bronches s\'éclaircissent.',
  },
  {
    key: 'cellules', name: 'Cellules et risque', short: 'Cellules',
    now: 'Le plus lent. Des cellules bronchiques épargnées repeuplent les voies aériennes, et le risque baisse sur des années. La moitié du gain en 3 ans, presque tout en 10 ans.',
    source: 'jha', source2: 'yoshida', image: 'Sur l\'image : les dernières taches qui s\'effacent.',
  },
];

// Les 8 jours où la plupart des rechutes se jouent (Hughes 2004).
export const FIRST_DAYS = [
  { title: 'Jour 0. Le plus simple : aucune clope sur toi', text: 'Jette le briquet, le cendrier, le paquet vide. Lave la veste qui sent. Ce soir, couche-toi tôt.' },
  { title: 'Jour 1. Le manque arrive', text: 'Irritable, tête dans le brouillard : c\'est la nicotine qui s\'en va. Prépare de l\'eau et quelque chose à mâcher.' },
  { title: 'Jour 2. Souvent le plus dur', text: 'Le manque monte souvent vers là. Réduis ce que tu peux : pas de grosse décision, pas de chiffres du business à minuit.' },
  { title: 'Jour 3. Tiens bon, ça redescend', text: 'Beaucoup trouvent les premiers jours les plus durs. Bouge au moins 5 minutes dès que l\'envie arrive.' },
  { title: 'Jour 4. Repère l\'heure de l\'envie', text: 'Café, après manger, fin de journée : regarde ce que l\'appli a noté et ajuste ton plan.' },
  { title: 'Jour 5. Le sommeil peut être bizarre', text: 'Réveils, rêves étranges : c\'est fréquent et ça passe. Moins de café le soir, il agit plus fort sans la clope.' },
  { title: 'Jour 6. Attention au « juste une »', text: 'L\'envie peut baisser ici et te faire croire que tu contrôles. Une seule rallume le manque.' },
  { title: 'Jour 7. Une semaine', text: 'Tu as gardé {semaine} et tu viens de passer la semaine la plus risquée. Fais-toi un vrai plaisir, petit.' },
  { title: 'Jour 8. Cap franchi', text: 'La plupart des rechutes arrivent avant aujourd\'hui. Les envies vont s\'espacer. Elles reviendront parfois, plus courtes.' },
];

export const TRIGGERS = [
  { id: 'stress', label: 'Stress, business' },
  { id: 'cafe', label: 'Café' },
  { id: 'repas', label: 'Après manger' },
  { id: 'pause', label: 'Pause, ennui' },
  { id: 'social', label: 'Avec d\'autres' },
  { id: 'alcool', label: 'Alcool' },
  { id: 'reveil', label: 'Au réveil' },
  { id: 'autre', label: 'Autre' },
];

export const DEFAULT_PLANS = [
  { id: 'stress', when: 'je suis stressé par le business', then: 'je fais 1 minute de respiration ici, puis je sors marcher 5 minutes' },
  { id: 'cafe', when: 'je prends un café', then: 'je le bois ailleurs que là où je fumais, un chewing-gum à côté' },
  { id: 'repas', when: 'je finis de manger', then: 'je me lève tout de suite et je me brosse les dents' },
];

export const MOVES = [
  'Sors marcher vite 5 minutes, sans téléphone.',
  'Monte et descends un escalier, 3 fois.',
  '20 squats, 10 pompes, recommence jusqu\'à la fin du minuteur.',
  'Un grand verre d\'eau froide, puis 2 minutes de marche.',
];
