# Mettre Millésime en ligne — pas à pas

Guide pour celui qui exploite le jeu. Il ne suppose aucune connaissance
technique : chaque étape dit où cliquer et ce qu'on doit voir apparaître.

## L'adresse du jeu

**https://millesime-weld.vercel.app**

Elle est en ligne, elle marche, et **c'est la seule à utiliser**. Ouvre-la, tu
dois voir l'écran d'accueil de Millésime.

---

## D'abord, comprendre ce qu'on fait

Le jeu est **un site web**. Un site web, ce sont des fichiers.

- **GitHub** (dépôt `Imbabz/Millesime`) est l'entrepôt où ces fichiers sont
  rangés.
- **Vercel** va les chercher chez GitHub, les assemble, et sert l'adresse
  ci-dessus. C'est tout ce qu'il fait — et c'est déjà fait.
- **Spotify** sert à jouer la musique. Le jeu lui parle pour lancer les morceaux
  sur ton enceinte.
- **Supabase** sert à ce que plusieurs téléphones se parlent pendant une partie.

Les deux derniers sont **indépendants** et s'ajoutent après coup. On peut très
bien jouer tout de suite sur un seul téléphone sans musique, et décider ensuite
si on va plus loin.

Il ne reste donc que deux étapes réelles : la musique, puis les téléphones.

---

## Étape 1 — Installer et déjà jouer (5 minutes)

1. Ouvrir **https://millesime-weld.vercel.app** *dans Safari sur ton iPhone*.
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

> **Ajoute-le à l'écran d'accueil, ne reste pas dans l'onglet Safari.** En mode
> installé, l'app occupe tout l'écran, garde sa configuration et ne risque pas de
> se faire fermer par une autre page.

---

## Étape 2 — La musique (10 minutes)

Il faut créer une « application » chez Spotify. Ça a l'air impressionnant : ce
n'est qu'un formulaire qui te donne un numéro d'identification.

> **Spotify Premium est obligatoire.** Commander la lecture à distance n'existe
> pas sur les comptes gratuits. Il n'y a aucun contournement.

### 2a. Récupérer l'adresse à déclarer

Dans le jeu, ouvrir **⚙ Configuration** (en bas de l'écran d'accueil). Sous
*Redirect URI à déclarer*, appuyer sur **Copier**. Garde-la, on la colle dans
une minute. Elle doit valoir `https://millesime-weld.vercel.app/` ; si elle
affiche autre chose, c'est que tu n'es pas sur la bonne adresse.

### 2b. Créer l'application Spotify

1. Aller sur **developer.spotify.com/dashboard** et se connecter avec ton compte
   Spotify habituel.
2. Cliquer sur **« Create app »**.
3. Remplir :
   - *App name* : `Millesime` (n'importe quoi fait l'affaire)
   - *App description* : `jeu de soirée`
   - *Redirect URI* : **coller l'adresse copiée à l'étape 2a**, puis cliquer sur
     *Add*. Elle doit apparaître dans la liste en dessous.
   - Cocher **Web API**.
   - Accepter les conditions, puis **Save**.
4. Sur la page de l'application créée, cliquer sur **Settings**. Copier le
   **Client ID** (une longue suite de lettres et de chiffres).

### 2c. Autoriser ton compte

Toujours dans les réglages de l'application Spotify, onglet **User Management** :
ajouter ton nom et l'adresse e-mail de ton compte Spotify. Sans ça, Spotify
refusera la connexion.

*(Cette liste accepte 5 personnes. Une seule suffit : seul l'hôte se connecte,
les invités n'ont besoin d'aucun compte.)*

### 2d. Brancher le tout

Retourner dans **⚙ Configuration** du jeu, coller le **Client ID** dans le champ
prévu, puis appuyer sur **« Se connecter à Spotify »**. Spotify demande
l'autorisation, tu acceptes, et le jeu revient.

### 2e. Choisir d'où sort le son

Ouvrir l'application Spotify sur un appareil et lancer n'importe quel morceau
une seconde, pour qu'elle se signale. Puis, dans une partie, appuyer sur le
bouton **🔊** et choisir la sortie.

> **Choisis une enceinte, pas ton téléphone.** Un téléphone qui joue son propre
> son affiche le titre et l'année sur son écran verrouillé — autant regarder la
> réponse. Le jeu t'avertit si l'appareil choisi est un téléphone.

---

## Étape 3 — Plusieurs téléphones (10 minutes)

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
| « Aucun appareil Spotify actif » | Aucune enceinte ne s'est signalée | Ouvrir Spotify, jouer un morceau une seconde, revenir, bouton 🔊 |
| Spotify refuse la connexion | L'adresse ne correspond pas | Vérifier que la *Redirect URI* déclarée est exactement celle affichée dans ⚙ Configuration |
| Idem, sur une adresse en `-git-` ou suivie de lettres au hasard | Tu es sur une *prévisualisation* Vercel | Revenir sur `millesime-weld.vercel.app`. Chaque brouillon a une adresse différente, que Spotify n'accepte pas |
| « La lecture demande Premium » | Compte gratuit | Rien à faire, Premium est requis |
| Le QR code ne mène nulle part | Supabase pas renseigné | Étape 3 |
| Les invités ne voient pas la partie | Idem | Étape 3 |
| Une correction ne s'affiche pas | Ancienne version en cache | Fermer l'app et la rouvrir. Le service worker est revalidé à chaque chargement, une seconde ouverture suffit |

---

## Annexe — comment une modification arrive en ligne

Rien à faire à la main. Vercel surveille la branche `main` de
`Imbabz/Millesime` : à chaque envoi de code, il reconstruit et remplace
l'adresse de production en une à deux minutes. Les autres branches produisent des
adresses de *prévisualisation*, utiles pour vérifier avant de publier — mais
Spotify n'y fonctionne pas, voir le tableau ci-dessus.

Pour renommer l'adresse : *Vercel → projet `millesime` → Settings → General →
Project Name*. Le domaine `.vercel.app` suit le nom du projet. Si tu la changes,
il faut **redéclarer la nouvelle Redirect URI chez Spotify**, sinon la connexion
casse.
