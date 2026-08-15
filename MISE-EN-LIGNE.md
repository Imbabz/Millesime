# Millésime — mise en route

## L'adresse

**https://millesime-weld.vercel.app**

C'est le jeu, en ligne, **déjà configuré**. Rien à coller, rien à renseigner :
les clés Supabase et Spotify sont embarquées dans l'application. Tu peux
envoyer ce lien à qui tu veux, il jouera sans compte et sans installation.

---

## Étape 1 — Installer et jouer (5 minutes)

1. Ouvrir l'adresse **dans Safari sur ton iPhone**.
2. Bouton **Partager** → **« Sur l'écran d'accueil »**. Le jeu devient une icône,
   comme une vraie application.
3. L'ouvrir depuis l'écran d'accueil → **« Jouer sur ce seul téléphone »** →
   un prénom → **« Lancer la partie »**.

Une partie complète se déroule : l'arbitre tire la carte, le joueur place le
morceau, la révélation tombe. **Sans son** — c'est l'étape 2.

C'est le moment de juger le *jeu* : le rythme, la clarté de qui fait quoi.

---

## Étape 2 — Le son (5 minutes, une seule fois)

Le Client ID Spotify est déjà dans l'app. Il reste deux choses à faire **chez
Spotify**, que personne d'autre que le propriétaire du compte ne peut faire.

> **Spotify Premium est obligatoire.** Commander la lecture à distance n'existe
> pas sur les comptes gratuits, et depuis février 2026 une app en Development
> Mode exige que son propriétaire soit Premium. Aucun contournement.

1. **developer.spotify.com/dashboard** → ton app → **Settings**.
2. **Redirect URIs** : il doit y avoir exactement
   `https://millesime-weld.vercel.app/` — **la barre finale compte**. Sinon
   *Edit*, l'ajouter, *Save*.
3. Onglet **User Management** : ajouter ton nom et l'e-mail de ton compte
   Spotify. Sans ça la connexion sera refusée après le login.
   *(5 places. Une seule suffit : seul l'hôte se connecte à Spotify.)*

Puis, dans le jeu : **⚙ Configuration → Se connecter à Spotify**.

### D'où sort le son

Spotify ne sait commander que des appareils déjà réveillés — c'est une limite de
Spotify, pas du jeu. Si aucun ne l'est, le jeu te le dit à l'écran et propose
**▶ Ouvrir Spotify** : un aller-retour, et le morceau démarre tout seul au
retour.

Dans une partie, le bouton **🔊** choisit la sortie.

> **Choisis une enceinte, pas ton téléphone.** Un téléphone qui joue son propre
> son affiche le titre et l'année sur son écran verrouillé — autant regarder la
> réponse. Le jeu t'avertit si l'appareil choisi est un téléphone.

---

## Étape 3 — Plusieurs téléphones

**Rien à configurer.** « Créer une partie » affiche un QR code ; les invités le
scannent avec l'appareil photo, tapent leur prénom, jouent. Ils n'ont besoin ni
de compte, ni de Spotify, ni de rien installer.

---

## Étape 4 — Vérifier le deck (à faire une fois, avant une soirée)

⚙ Configuration → 🗂 **Vérifier le deck** → *Lancer la vérification*.

604 recherches Spotify, plusieurs minutes. Ça associe chaque carte à un morceau
jouable et met le résultat en cache définitivement, ce qui évite un blanc au
milieu d'un tour. Les cartes introuvables sont listées : envoie-moi la liste,
je corrige le catalogue.

---

## Le jour de la soirée

1. Ouvrir le jeu depuis l'écran d'accueil.
2. Lancer Spotify une seconde, pour que l'enceinte se signale.
3. « Créer une partie », choisir décennies et genres, montrer le QR code.
4. Poser son téléphone à plat quand ce n'est pas son tour.

---

## Si ça coince

| Ce que tu vois | Ce que c'est | Quoi faire |
|---|---|---|
| `INVALID_CLIENT: Invalid redirect URI` | L'URI déclarée ne correspond pas au caractère près | Étape 2, point 2 — la barre finale |
| Refus mentionnant le *Developer Dashboard* | Ton compte n'est pas dans la liste | Étape 2, point 3 |
| « Aucun appareil Spotify actif » | Aucune enceinte ne s'est signalée | Appuyer sur **▶ Ouvrir Spotify** dans le message : le jeu relance au retour |
| « La lecture demande Premium » | Compte gratuit | Premium est requis |
| Les invités n'arrivent pas dans le salon | Projet Supabase en pause | Voir l'annexe |
| Une correction ne s'affiche pas | Ancienne version en cache | Fermer l'app et la rouvrir |
| Adresse en `-git-` ou suivie de lettres au hasard | Déploiement de prévisualisation | Revenir sur `millesime-weld.vercel.app` ; Spotify n'accepte que celle-là |

---

## Annexe — les clés changent-elles ?

**Non.** Une fois posées, elles le restent :

- **Supabase** — l'URL du projet et la clé `anon` sont fixes pour la vie du
  projet. Cette clé expire en 2036 et ne tourne que si tu la révoques toi-même.
- **Spotify** — le Client ID est fixe. Il n'y a pas de secret associé, donc rien
  à renouveler.
- **L'adresse** — fixe tant que le projet Vercel s'appelle `millesime`. Le
  renommer changerait le domaine, et il faudrait alors redéclarer la Redirect
  URI chez Spotify.

Elles sont inscrites dans le code (`src/config.ts`), donc tout appareil qui
ouvre l'adresse est configuré d'office. Une variable d'environnement Vercel du
même nom prend le pas si tu en poses une un jour ; ce n'est pas nécessaire.

**Le seul entretien récurrent** : un projet Supabase gratuit se met en pause
après environ une semaine sans activité. Le jeu marche toujours en solo, mais
les invités n'arrivent plus. Il se relance depuis le tableau de bord Supabase
(*Restore project*) en une minute — ou demande-moi, je peux le faire.

## Annexe — comment une modification arrive en ligne

Vercel surveille la branche `main` de `Imbabz/Millesime` : à chaque envoi de
code il reconstruit et remplace l'adresse de production en une à deux minutes.
Les autres branches produisent des adresses de prévisualisation, sur lesquelles
Spotify ne fonctionne pas.
