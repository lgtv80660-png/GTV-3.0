# GTV 3.0 — Cloudflare Frontend

Ce ZIP contient l'interface GTV 3.0 optimisée pour Cloudflare Workers via OpenNext.
Toutes les routes `/api/*` passent par un gateway same-origin vers Railway, ce qui conserve le cookie `gtv_session` et évite les problèmes CORS côté navigateur.

## Variable obligatoire

`RAILWAY_BACKEND_URL=https://votre-service.up.railway.app`

Ne mettez pas les identifiants Xtream dans le frontend. Le login crée le cookie HTTP-only via le backend Railway et le gateway le relaie.

## Commandes

- `npm install`
- `npm run dev`
- `npm run build:cloudflare`
- `npm run deploy:cloudflare`

## Optimisations incluses

- LivePlayer et VideoPlayer chargés dynamiquement.
- Football / beIN / FIFA chargés uniquement lorsqu'une chaîne ou catégorie sport est sélectionnée.
- Lot initial des chaînes réduit pour diminuer le DOM.
- Images de cartes en lazy-loading + décodage asynchrone.
- Backend média/FFmpeg retiré du frontend.

## Passe Performance V2

Voir `PERFORMANCE-V2.md`. La Home utilise maintenant `/api/home-feed`, les catalogues sont progressifs, les panneaux Sport/FIFA sont chunkés dynamiquement et les players sont isolés du reste des rerenders.
