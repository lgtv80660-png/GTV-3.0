# Validation VOD réelle avant activation des publicités

Le socle GPlayerAds est volontairement non branché. Aucun appel publicitaire ni
changement des routes existantes. Son futur appelant doit fournir un deuxième
élément vidéo, afficher son overlay pendant la publicité et masquer ses commandes.
Les événements progression/fin et la persistance restent attachés au film uniquement.
Ne pas activer les publicités avant validation de la lecture réelle.

Sur une session authentifiée avec un film disponible :

1. Ouvrir un film utilisant le flux Railway existant. Vérifier le poster puis
   démarrer avec les commandes natives. Vérifier image et son.
2. Pause/lecture, puis seek en avant et en arrière : le film doit reprendre.
3. Entrer/sortir du plein écran avec les commandes natives du navigateur.
4. Après plus de 15 secondes, quitter puis rouvrir le film : vérifier la reprise.
5. Aller à la fin : vérifier que la position mémorisée est effacée.
6. Vérifier une erreur de flux : message lisible, sans URL ni identifiants exposés.
7. Répéter avec le mode Apple/HLS et les navigateurs cibles. Le chemin
   /api/vod-hls sélectionne le moteur HLS ; les autres flux gardent leur extension.
   Un MKV/codec non pris en charge nativement peut échouer : aucun transcodage ajouté.

Pour la future intégration Ads : tester fin normale, erreur média, refus de play,
film initialement en pause, position zéro, puis démontage/changement de film.
Vérifier qu'aucune progression de publicité n'est enregistrée comme celle du film.
Le démontage laisse le film en pause ; le futur appelant gère son cycle de vie.

Le build ne valide pas la lecture réelle. Consigner pour chaque essai le navigateur,
le type de flux et le résultat, sans partager d'URL contenant des identifiants.
