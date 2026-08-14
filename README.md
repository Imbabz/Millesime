# 🎙 Millésime

Un jeu de placement musical qui se joue **à plusieurs téléphones**, autour d'une
enceinte. Un morceau démarre, personne ne voit ni le titre ni l'année, et il faut
le ranger au bon endroit dans sa frise chronologique. Les autres guettent
l'erreur pour voler la carte.

Mécaniques reprises du genre « devine l'année », adaptées au mobile :
l'application est le support, le jeu reste la musique et les gens autour.

---

## Comment ça marche

- **Une app web installable (PWA)**, pas une app native. Un invité scanne un QR
  code avec l'appareil photo, tape son prénom, et joue. Aucune installation,
  aucun compte, aucun Spotify de son côté.
- **L'arbitre tourne à chaque tour.** Le joueur à gauche de celui qui joue tire
  la carte et lance le morceau, exactement comme le joueur qui scanne la carte
  dans le jeu physique. Celui qui doit deviner ne touche à rien : c'est ce qui
  l'empêche d'être trahi par son propre écran.
- **Seul l'hôte se connecte à Spotify.** La musique sort par **Spotify Connect**
  sur l'appareil de son choix : enceinte Bluetooth, Google Home, l'app Spotify du
  téléphone. Elle continue quand l'écran se verrouille, contrairement à un
  lecteur intégré au navigateur.
- **N'importe quel téléphone peut mettre en pause ou relancer.** La commande
  transite par l'hôte, qui est le seul à parler à Spotify.
- **L'hôte fait autorité** sur l'état de la partie. C'est ce qui rend arbitrable
  la course au vol : un seul appareil horodate les demandes, donc aucun téléphone
  ne peut être en désaccord sur qui a gagné une carte.
- **Karaoké synchronisé** après chaque révélation, via
  [LRCLIB](https://lrclib.net) (paroles synchronisées, gratuit, sans clé).

## Les règles

- Objectif : **10 cartes bien placées** (réglable). La carte de départ compte.
- **L'arbitre du tour** — le voisin de gauche du joueur actif — tire la carte,
  contrôle la lecture, et tranche après la révélation si l'annonce du titre et
  de l'artiste était juste. Il ne voit pas la réponse avant les autres, donc il
  joue et vole normalement.
- Bien placé → la carte rejoint la frise. Mal placé → défausse.
- **Jeton** : +1 si on annonce le titre *et* l'artiste, même en cas de mauvais
  placement. Maximum 5 jetons.
- **Voler** : dépenser 1 jeton pour désigner un *autre* emplacement de la frise
  de l'adversaire. Deux joueurs ne peuvent pas viser le même : le plus rapide le
  réserve. Le jeton est perdu même si l'adversaire avait raison.
- **Échanger** 3 jetons contre la carte en cours, posée gratuitement.

Le rappel des règles est accessible à tout moment, sur tous les téléphones, via
le bouton « ? ».

---

## Développement

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # moteur de règles, deck, paroles, parcours d'interface
npm run typecheck
npm run lint
npm run build        # BASE_PATH=/Magellan/ pour un déploiement GitHub Pages
```

### Mode démo et partie sur un seul téléphone

Ouvrir `?dev=1#/room/ABCD` : quatre joueurs, aucune connexion réseau, un faux
lecteur qui avance vraiment. La partie entière est jouable sans le moindre
identifiant — c'est aussi le filet qui rend l'interface testable en CI.

Sur un seul appareil, le téléphone se fait passer pour le joueur que la phase
concerne, et une bannière indique à qui le tendre. Rien n'est secret entre
joueurs — frises et jetons sont face visible, et la seule chose cachée est la
carte, que personne ne voit — donc un téléphone qui circule suffit.

### Structure

| Dossier | Rôle |
|---|---|
| `src/game/` | Le moteur de règles, pur : aucun React, aucun réseau, entièrement testé. |
| `src/deck/` | Le catalogue de 604 cartes, les années vérifiées, et leurs tests. |
| `src/net/` | `LocalTransport` (un appareil) et `SupabaseTransport` (temps réel). |
| `src/session/` | Identité du joueur, code de salon, liaison moteur ↔ transport. |
| `src/spotify/` | Auth PKCE, client API, contrôleur Connect, résolution du deck. |
| `src/lyrics/` | Client LRCLIB et parseur LRC. |
| `src/screens/` | Un écran par phase de jeu. |
| `src/ui/` | Frise, jetons, feuilles, QR code. |

### Les années sont vérifiées, et verrouillées

C'est le choix structurant du projet. `album.release_date` renvoie la date du
master servi : 2011 pour *Bohemian Rhapsody*, 2015 pour la moitié de la Motown.
Comme dater les morceaux **est** le jeu, l'année ne peut pas venir de Spotify,
qui ne sert qu'à trouver quelque chose à jouer.

Chaque carte porte donc une année **vérifiée et sourcée** dans
`src/deck/years.json`, et un test refuse toute carte qui n'en a pas, ou dont
l'année contredit sa source. La vérification tourne en CI contre **MusicBrainz**,
qui modélise les enregistrements séparément des sorties et expose
`first-release-date` — précisément la question que pose le jeu :

```bash
npm run verify:years   # interroge MusicBrainz, écrit years.report.json (~11 min)
npm run apply:years    # fusionne les concordances, liste ce qui reste à trancher
```

Les concordances passent seules : deux sources indépendantes qui disent la même
chose ne demandent aucun arbitrage. Les désaccords sont tranchés à la main, avec
une note expliquant pourquoi — MusicBrainz se trompe assez souvent pour qu'une
réécriture automatique remplace une série d'erreurs par une autre.

Un mauvais millésime est invisible en partie : la carte devient simplement
impossible à placer, et c'est le joueur qui se fait accuser.

La difficulté d'une carte décrit sa difficulté à **dater**, pas sa notoriété.
Une carte `hard` est un titre que toute la table reconnaît et que personne ne
sait situer — Indeep, Alphaville, Desireless. Le constructeur de pioche les
saupoudre volontairement plutôt que de mélanger à plat.

---

## Configuration

Tout se règle depuis l'écran **⚙ Configuration** de l'app, sans redéploiement —
les valeurs sont stockées dans le navigateur. La CI peut fournir des valeurs par
défaut via les *variables* GitHub Actions (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_SPOTIFY_CLIENT_ID`).

1. **GitHub** → Settings → Pages → Source = *GitHub Actions*.
2. **supabase.com** → nouveau projet → copier *Project URL* et la clé *anon*.
   Aucune table à créer : seuls les canaux temps réel sont utilisés.
3. **developer.spotify.com/dashboard** → *Create app* → coller la Redirect URI
   affichée dans l'écran Configuration → copier le *Client ID*, et ajouter son
   compte Spotify aux utilisateurs autorisés.

> **Spotify Premium est obligatoire.** Depuis février 2026, une app en
> Development Mode exige que son propriétaire ait un abonnement Premium actif, et
> se limite à 5 comptes autorisés. Comme seul l'hôte se connecte, une seule place
> est consommée.

Aucune de ces valeurs n'est un secret : la clé `anon` de Supabase est publique
par conception, et le flux PKCE existe précisément pour qu'aucun client secret ne
soit embarqué.

### L'écran de l'hôte est un spoiler

L'app Spotify affiche le titre et l'année du morceau en cours. Idéalement la
musique sort d'une enceinte séparée ; sinon, posez le téléphone de l'hôte écran
vers le bas.

---

## Crédits

Paroles : [LRCLIB](https://lrclib.net). Musique : Spotify.
Projet personnel, non affilié à quelque éditeur de jeu que ce soit.
