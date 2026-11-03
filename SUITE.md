# Souffle : pour reprendre

Appli pour arrêter de fumer : dernier paquet, poumons qui s'éclaircissent, argent gardé, envies.
Fichiers statiques, aucun serveur, données dans le téléphone uniquement.

- `js/model.js` : le calcul de récupération. Tests : `node --test test/model.test.js`.
- `js/content.js` : tout ce qui s'appuie sur une étude, avec sa source.
- `js/lungs.js` : le rendu WebGL. Il lit les 3 cartes de `assets/`.
- `tools/bake_lungs.py` : fabrique ces cartes. Il a besoin de numpy, scipy et Pillow.
- `tools/planche.html` : compare 6 états des poumons côte à côte.
- `js/app.js` : les écrans. `js/store.js` : les données.

Après un changement de fichier listé dans `sw.js`, rien à faire : le cache se rafraîchit en arrière-plan.
Après l'ajout d'un fichier, l'ajouter à la liste `FILES` de `sw.js`.

Deux plans possibles, choisis dans la feuille « Réduire, puis arrêter » :
- arrêt net : un dernier paquet (`packStart`), chaque clope après lui est un écart ;
- réduction : `profile.quitAt` (minuit du Jour 0) et `profile.limit` (clopes par jour d'ici là).
  Pendant la réduction, une clope n'est jamais traitée comme un écart. Après `quitAt`, si.
`profile.planAsked` évite de reproposer le plan à chaque ouverture.

Honnêteté du calcul : le pourcentage est une estimation calée sur des délais publiés, pas une mesure.
Le monoxyde de carbone reste hors du pourcentage : il part en un jour et ne dit rien de la guérison des poumons.
Le poids de chaque partie et la pénalité d'une cigarette sont des choix de calcul, écrits dans l'écran Sources.
Une étude a déjà contredit un texte (Kirchner 2012 : la culpabilité ne prédit pas l'écart suivant) :
vérifier ce que dit la source avant d'écrire une phrase.
