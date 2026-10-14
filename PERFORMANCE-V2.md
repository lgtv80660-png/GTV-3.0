# GTV 3.0 — Performance V2

Cette version sépare le frontend Cloudflare du backend Railway et ajoute une passe de performance plus profonde.

## Changements principaux

- Home: une seule route `/api/home-feed` renvoie un flux réduit au lieu de télécharger les catalogues VOD + séries complets dans le navigateur.
- Films / séries: première catégorie chargée par défaut au lieu de `Tous`, rendu progressif 48 éléments puis lots supplémentaires au scroll.
- Images de catégories: chargement uniquement à proximité du viewport avec `IntersectionObserver` + cache mémoire.
- Images de cartes: `loading=lazy`, `decoding=async`, priorité basse.
- Live: lecteur chargé dynamiquement et mémorisé; props du player stabilisées.
- Live sport: panneau football séparé en chunk dynamique; FIFA séparé dans un second chunk, donc non téléchargé pour une chaîne normale.
- Live cache: index des chaînes hydraté une seule fois au lieu de scanner tout `sessionStorage` à chaque recalcul beIN.
- Navigation: chargement dynamique pour diminuer le coût initial des pages.
- VideoPlayer: mises à jour UI limitées à ~4/s et callback de progression limité à ~1/s pour éviter des rerenders/écritures inutiles.
- Mobile: réduction du coût `backdrop-filter`.

## Backend Railway

- Cache mémoire + déduplication des requêtes Xtream par utilisateur/action/catégorie.
- `/api/home-feed` avec payload réduit et cache 10 min.
- HLS segments streamés directement (`Response.body`) au lieu de charger chaque segment entier en RAM.
- Logs HLS verbeux retirés.
- Cache TMDB pour images de catégorie, acteurs et logos de titres.

## Vérification effectuée

Tous les fichiers `.ts` / `.tsx` des deux projets ont été passés par le parser/transpileur TypeScript : aucune erreur de syntaxe.

`npm install` n'a pas terminé dans le délai de l'environnement, donc le build Next complet doit encore être exécuté après téléchargement avec `npm install && npm run build`.
