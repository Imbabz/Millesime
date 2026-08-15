# Mettre Millésime en ligne

Guide destiné à celui qui exploite le jeu, pas à celui qui le développe. Écrit
parce que trois sujets sans rapport se sont mélangés en cours de route.

---

## Les trois briques, indépendantes

| | À quoi ça sert | Sans ça | Obligatoire ? |
|---|---|---|---|
| **1. Héberger** | Mettre l'app à une URL ouvrable depuis un téléphone | Rien à ouvrir | **Oui** |
| **2. Spotify** | La musique | Le jeu tourne, en silence | Oui pour jouer vraiment |
| **3. Supabase** | Plusieurs téléphones | Un seul téléphone qu'on se passe | Non |

Chacune se règle et se teste séparément. On peut s'arrêter après la première
pour voir à quoi ressemble le jeu.

### Ce qu'il n'y a **pas** à faire

- **GitHub Pages** : abandonné. Il refuse les dépôts privés sur l'offre
  gratuite, c'est ce qui a fait basculer le projet vers Vercel. Le code est
  configuré pour Vercel ; il n'y a plus rien à en penser.
- **Un jeton d'accès personnel GitHub** (*Settings → Developer settings*) : ne
  sert qu'à un agent automatisé qui n'a pas le droit d'écrire dans le dépôt.
  Depuis un ordinateur, il est inutile.

> **Spotify Premium est obligatoire** pour la musique. La lecture à distance
> n'existe pas sur les comptes gratuits, et aucun contournement n'est possible.
> Le dashboard développeur de Spotify n'a rien à voir avec GitHub : c'est un
> formulaire de deux minutes pour obtenir un identifiant d'application.

---

## 1. Héberger

### Option A — ne rien copier du tout

La plus rapide, et sans une seule commande. Vercel sait construire un
sous-dossier d'un dépôt privé personnel.

Sur vercel.com → *Add New… → Project* → choisir le dépôt qui contient déjà le
code, puis dans les réglages du projet :

- **Root Directory** : le sous-dossier qui contient l'app (`hitster`).
- **Production Branch** : la branche qui contient ce dossier.
- **Framework** : Vite. **Build** : `npm run build`. **Output** : `dist`.

Vercel construit et publie. Rien d'autre.

### Option B — depuis un ordinateur, en ligne de commande

La voie propre, si l'app doit vivre dans son propre dépôt. Trois commandes,
aucun jeton : l'authentification passe par le navigateur ou par les identifiants
git déjà en place.

```bash
git clone --single-branch --branch millesime-root \
  https://github.com/Imbabz/Magellan.git millesime
cd millesime
git push https://github.com/Imbabz/millesime.git millesime-root:main
```

`--single-branch` ne récupère que l'historique du jeu. Le contenu est déjà à la
racine, `vercel.json` inclus. Vercel détecte le push et construit tout seul.

Dans les réglages du projet Vercel : **Root Directory vide**, Framework Vite,
build `npm run build`, sortie `dist`.

### Option C — sans ligne de commande

**GitHub Desktop** (Windows/macOS) fait la même chose en quelques clics :
*Clone repository* → l'URL de Magellan → choisir la branche `millesime-root` →
*Repository → Repository settings → Remote* → remplacer l'URL par celle de
`millesime` → *Push origin*.

### Option D — téléverser les fichiers sur github.com

Techniquement possible (*Add file → Upload files*), mais à éviter ici : une
soixantaine de fichiers répartis en dossiers, tout l'historique perdu, et un
oubli de fichier ne se voit qu'au moment où la construction échoue.

---

## 2. Spotify

Nécessaire uniquement pour le son. **Seul l'hôte** fait cette manipulation ; les
invités n'ont besoin d'aucun compte.

1. Ouvrir l'app déployée, aller dans **⚙ Configuration**, et copier la
   **Redirect URI** affichée (bouton *Copier*). Elle correspond exactement au
   domaine où l'app est servie.
2. Sur **developer.spotify.com/dashboard** → *Create app* :
   - un nom quelconque,
   - coller la Redirect URI telle quelle,
   - cocher *Web API*.
3. Copier le **Client ID** de l'app créée, le coller dans l'écran Configuration.
4. Dans les réglages de l'app Spotify, ajouter son propre compte à la liste des
   utilisateurs autorisés (5 maximum en Development Mode — un seul est utilisé,
   puisque seul l'hôte se connecte).

> **La connexion ne fonctionnera pas sur un déploiement de prévisualisation.**
> Vercel donne une URL unique à chaque commit, et Spotify exige une
> correspondance exacte : seul le domaine de production est déclaré. L'écran
> Configuration affiche l'URL courante, ce qui permet de reconnaître le cas.

---

## 3. Supabase

Nécessaire uniquement pour jouer à plusieurs téléphones.

1. **supabase.com** → nouveau projet (offre gratuite).
2. Copier *Project URL* et la clé *anon* dans l'écran ⚙ Configuration.

Aucune table à créer, aucun schéma : seuls les canaux temps réel sont utilisés.
La clé *anon* est publique par conception, elle n'a pas à être protégée.

---

## Dans quel ordre tester

1. **Ouvrir l'URL sur le téléphone**, l'ajouter à l'écran d'accueil, puis
   « Jouer sur ce seul téléphone ». Une partie complète tourne, sans musique.
   C'est le moment de juger le jeu avant d'aller plus loin.
2. **Ajouter Spotify**, relancer une partie : le morceau doit démarrer quand
   l'arbitre tire la carte. Si aucun appareil n'apparaît, ouvrir l'app Spotify
   une fois pour qu'elle se signale, puis choisir la sortie via le bouton 🔊.
3. **Ajouter Supabase**, créer un salon, faire scanner le QR code par un second
   téléphone.

Un détail qui compte pour la suite : la musique doit sortir d'une **enceinte**,
pas du téléphone de l'hôte. Un téléphone qui joue son propre son affiche le
titre et l'année sur son écran verrouillé, ce qui revient à voir la réponse.
L'app avertit quand l'appareil choisi est un téléphone.
