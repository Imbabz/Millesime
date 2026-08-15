# Mettre Millésime en ligne — pas à pas

Guide pour celui qui exploite le jeu. Il ne suppose aucune connaissance
technique : chaque étape dit où cliquer et ce qu'on doit voir apparaître.

---

## D'abord, comprendre ce qu'on fait

Le jeu est **un site web**. Un site web, ce sont des fichiers.

- **GitHub** est l'entrepôt où ces fichiers sont rangés. Ils y sont déjà.
- **Vercel** est un service qui va chercher les fichiers chez GitHub, les
  assemble, et te donne une **adresse** que tu peux ouvrir sur ton téléphone.
  C'est tout ce qu'il fait.
- **Spotify** sert à jouer la musique. Le jeu lui parle pour lancer les morceaux
  sur ton enceinte.
- **Supabase** sert à ce que plusieurs téléphones se parlent pendant une partie.

Les deux derniers sont **indépendants** et s'ajoutent après coup. On peut très
bien mettre le jeu en ligne, y jouer sur un seul téléphone sans musique, et
décider ensuite si on va plus loin.

Il y a **une seule chose obligatoire** pour commencer : l'étape 1.

---

## Étape 1 — Mettre le jeu en ligne (10 minutes)

Aucune commande, aucun logiciel à installer. Tout se fait sur un site.

1. Aller sur **vercel.com** et se connecter **avec son compte GitHub** (bouton
   *Continue with GitHub*). C'est ce qui autorise Vercel à lire tes fichiers.
2. Sur le tableau de bord, cliquer sur **« Add New… »** puis **« Project »**.
3. Vercel affiche la liste de tes dépôts GitHub. Choisir **`Magellan`** et
   cliquer sur **Import**.
   - *Si `Magellan` n'apparaît pas* : cliquer sur *Adjust GitHub App Permissions*
     et autoriser Vercel à voir ce dépôt.
4. Un écran de configuration s'affiche. Trois réglages à changer :
   - **Root Directory** : cliquer sur *Edit*, choisir le dossier **`hitster`**.
     C'est là que vit le jeu — le reste du dépôt est une autre application.
   - **Framework Preset** : doit indiquer **Vite**. S'il propose autre chose, le
     corriger.
   - **Build and Output Settings** : *Build Command* = `npm run build`,
     *Output Directory* = `dist`.
5. Cliquer sur **Deploy**, puis attendre une à deux minutes.

**Ce que tu dois voir :** une page de félicitations avec une capture du jeu et
une adresse en `.vercel.app`. C'est ton lien.

> ### Une chose à corriger tout de suite
>
> Vercel construit par défaut la branche principale du dépôt, et le jeu n'y est
> pas. Si le déploiement échoue, ou si l'adresse affiche l'application de voyage
> au lieu du jeu, va dans **Settings → Git → Production Branch** et saisis
> `claude/hitster-mobile-game-z18nda`. Puis **Deployments → … → Redeploy**.

---

## Étape 2 — Vérifier, et déjà jouer (5 minutes)

1. Ouvrir l'adresse `.vercel.app` **dans Safari sur ton iPhone**.
2. Appuyer sur le bouton **Partager** (le carré avec une flèche vers le haut),
   puis **« Sur l'écran d'accueil »**. Le jeu devient une icône, comme une vraie
   application.
3. L'ouvrir depuis l'écran d'accueil, appuyer sur **« Jouer sur ce seul
   téléphone »**, entrer un prénom, puis **« Lancer la partie »**.

Une partie complète se déroule : l'arbitre tire la carte, le joueur place le
morceau, la révélation tombe. **Il n'y a pas encore de son** — c'est normal,
c'est l'étape suivante.

Prends le temps de faire deux ou trois tours ici. C'est le moment de juger le
jeu avant d'aller plus loin.

---

## Étape 3 — La musique (10 minutes)

Il faut créer une « application » chez Spotify. Ça a l'air impressionnant : ce
n'est qu'un formulaire qui te donne un numéro d'identification.

> **Spotify Premium est obligatoire.** Commander la lecture à distance n'existe
> pas sur les comptes gratuits. Il n'y a aucun contournement.

### 3a. Récupérer l'adresse à déclarer

Dans le jeu, ouvrir **⚙ Configuration** (en bas de l'écran d'accueil). Sous
*Redirect URI à déclarer*, appuyer sur **Copier**. Garde-la, on la colle dans
une minute.

### 3b. Créer l'application Spotify

1. Aller sur **developer.spotify.com/dashboard** et se connecter avec ton compte
   Spotify habituel.
2. Cliquer sur **« Create app »**.
3. Remplir :
   - *App name* : `Millesime` (n'importe quoi fait l'affaire)
   - *App description* : `jeu de soirée`
   - *Redirect URI* : **coller l'adresse copiée à l'étape 3a**, puis cliquer sur
     *Add*. Elle doit apparaître dans la liste en dessous.
   - Cocher **Web API**.
   - Accepter les conditions, puis **Save**.
4. Sur la page de l'application créée, cliquer sur **Settings**. Copier le
   **Client ID** (une longue suite de lettres et de chiffres).

### 3c. Autoriser ton compte

Toujours dans les réglages de l'application Spotify, onglet **User Management** :
ajouter ton nom et l'adresse e-mail de ton compte Spotify. Sans ça, Spotify
refusera la connexion.

*(Cette liste accepte 5 personnes. Une seule suffit : seul l'hôte se connecte,
les invités n'ont besoin d'aucun compte.)*

### 3d. Brancher le tout

Retourner dans **⚙ Configuration** du jeu, coller le **Client ID** dans le champ
prévu, puis appuyer sur **« Se connecter à Spotify »**. Spotify demande
l'autorisation, tu acceptes, et le jeu revient.

### 3e. Choisir d'où sort le son

Ouvrir l'application Spotify sur un appareil et lancer n'importe quel morceau
une seconde, pour qu'elle se signale. Puis, dans une partie, appuyer sur le
bouton **🔊** et choisir la sortie.

> **Choisis une enceinte, pas ton téléphone.** Un téléphone qui joue son propre
> son affiche le titre et l'année sur son écran verrouillé — autant regarder la
> réponse. Le jeu t'avertit si l'appareil choisi est un téléphone.

---

## Étape 4 — Plusieurs téléphones (10 minutes)

1. Aller sur **supabase.com**, se connecter (le compte GitHub fait l'affaire).
2. **« New project »**. Donner un nom, choisir une région proche, et laisser le
   reste par défaut. Le mot de passe demandé ne resservira pas ici.
3. Attendre la fin de la création (une minute ou deux).
4. Dans le menu de gauche, **Project Settings** (l'engrenage) → **API**. Deux
   valeurs à copier :
   - **Project URL**
   - la clé **`anon` / `public`**
5. Les coller dans **⚙ Configuration** du jeu.

Il n'y a **aucune base de données à créer**, aucune table, aucun réglage. Le jeu
n'utilise que la messagerie temps réel.

Ensuite : « Créer une partie » affiche un **QR code**. Les invités le scannent
avec l'appareil photo de leur téléphone, entrent leur prénom, et jouent. Rien à
installer de leur côté, aucun compte.

---

## Le jour de la soirée

1. Ouvrir le jeu depuis l'écran d'accueil.
2. Lancer l'application Spotify une seconde, pour que l'enceinte se signale.
3. « Créer une partie », choisir décennies et genres, montrer le QR code.
4. Poser son téléphone à plat quand ce n'est pas son tour.

---

## Si ça coince

| Ce que tu vois | Ce que c'est | Quoi faire |
|---|---|---|
| Vercel affiche l'app de voyage | Mauvaise branche construite | *Settings → Git → Production Branch* = `claude/hitster-mobile-game-z18nda`, puis *Redeploy* |
| « Aucun appareil Spotify actif » | Aucune enceinte ne s'est signalée | Ouvrir Spotify, jouer un morceau une seconde, revenir, bouton 🔊 |
| Spotify refuse la connexion | L'adresse ne correspond pas | Vérifier que la *Redirect URI* déclarée est exactement celle affichée dans ⚙ Configuration |
| Idem, sur une adresse bizarre | Tu es sur une *prévisualisation* Vercel | Utiliser l'adresse principale du projet. Chaque brouillon a une adresse différente que Spotify n'accepte pas |
| « La lecture demande Premium » | Compte gratuit | Rien à faire, Premium est requis |
| Le QR code ne mène nulle part | Supabase pas renseigné | Étape 4 |
| Les invités ne voient pas la partie | Idem | Étape 4 |

---

## Annexe — ranger le jeu dans son propre dépôt (optionnel)

Le jeu vit aujourd'hui dans un sous-dossier d'un dépôt qui contient aussi une
application de voyage. Ça fonctionne très bien. Si tu veux un jour lui donner
son propre dépôt, la branche `millesime-root` est déjà prête : c'est le projet
seul, à la racine, avec son historique.

Depuis un ordinateur, trois commandes. Aucun jeton d'accès n'est nécessaire :

```bash
git clone --single-branch --branch millesime-root \
  https://github.com/Imbabz/Magellan.git millesime
cd millesime
git push https://github.com/Imbabz/millesime.git millesime-root:main
```

Il faut ensuite, dans Vercel, soit créer un projet sur ce nouveau dépôt (avec
*Root Directory* **vide**, cette fois), soit changer le dépôt du projet existant.

Sans ordinateur, **GitHub Desktop** fait la même chose en quelques clics :
cloner Magellan, choisir la branche `millesime-root`, remplacer l'URL du dépôt
distant par celle de `millesime`, pousser.

À éviter : téléverser les fichiers à la main sur github.com. Une soixantaine de
fichiers en arborescence, l'historique perdu, et un oubli ne se voit qu'au
moment où la construction échoue.
