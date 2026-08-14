/**
 * The rulebook, as data.
 *
 * Reachable from every screen at any moment through the "?" button, because in
 * a party game the rules question always comes mid-turn, from the person whose
 * turn it is not, and making them leave the board to find the answer is exactly
 * how the momentum dies.
 */

export type RuleSection = {
  id: string;
  title: string;
  lines: string[];
};

export const RULES: RuleSection[] = [
  {
    id: 'but',
    title: '🎯 Le but',
    lines: [
      'Constituer une frise de morceaux rangés du plus ancien au plus récent.',
      'Le premier à poser correctement 10 cartes gagne la partie. La carte de départ compte.',
    ],
  },
  {
    id: 'arbitre',
    title: '🎴 L’arbitre du tour',
    lines: [
      'À chaque tour, le joueur à gauche de celui qui joue devient l’arbitre.',
      'C’est lui qui tire la carte et lance le morceau : le joueur actif ne touche à rien, donc rien ne peut le trahir.',
      'Il contrôle la lecture — pause, reprise, retour au début.',
      'Il ne voit pas la réponse avant les autres : il manipule la carte sans la retourner. Il peut donc jouer et voler normalement.',
      'Après la révélation, c’est lui qui tranche si l’annonce du titre et de l’artiste était juste.',
      'Le rôle tourne à chaque tour, comme le reste.',
    ],
  },
  {
    id: 'tour',
    title: '🎧 Ton tour',
    lines: [
      'L’arbitre tire la carte et le morceau se lance. Personne ne voit ni le titre, ni l’artiste, ni l’année.',
      'Écoute, puis choisis l’endroit de TA frise où tu penses qu’il se range : avant, entre deux cartes, ou après.',
      'L’arbitre peut mettre en pause et relancer autant que nécessaire ; les autres aussi, en cas de besoin.',
      'Bien placé : la carte rejoint ta frise. Mal placé : elle part à la défausse.',
    ],
  },
  {
    id: 'jeton',
    title: '🪙 Gagner un jeton',
    lines: [
      'Avant de valider, annonce que tu connais le titre ET l’artiste.',
      'Dis-les à voix haute : c’est l’arbitre du tour qui juge, pas l’application.',
      'Si c’est juste, tu gagnes un jeton — même si tu as mal placé la carte.',
      'On ne peut pas détenir plus de 5 jetons.',
    ],
  },
  {
    id: 'voler',
    title: '⚡ Voler une carte',
    lines: [
      'Quand un adversaire valide son placement, tu peux crier « MILLÉSIME ! » en appuyant sur le bouton.',
      'Ça coûte 1 jeton, et tu dois désigner un AUTRE emplacement que le sien.',
      'Deux joueurs ne peuvent pas viser le même emplacement : le plus rapide le prend.',
      'S’il s’est trompé et que ton emplacement est le bon, la carte part dans TA frise.',
      'Le jeton est dépensé dans tous les cas, même si le joueur avait raison.',
    ],
  },
  {
    id: 'echange',
    title: '🔁 Échanger 3 jetons',
    lines: [
      'À ton tour, tu peux troquer 3 jetons contre la carte en cours.',
      'Elle se pose toute seule au bon endroit, sans avoir à deviner quoi que ce soit.',
    ],
  },
  {
    id: 'karaoke',
    title: '🎤 Karaoké',
    lines: [
      'Après chaque révélation, le morceau peut repartir du début avec les paroles synchronisées.',
      'Tous les téléphones défilent ensemble. C’est optionnel, et c’est là que la soirée bascule.',
    ],
  },
  {
    id: 'fin',
    title: '🏁 Fin de partie',
    lines: [
      'Dès qu’un joueur atteint l’objectif, la partie s’arrête à la fin de la révélation en cours.',
      'Si la pioche s’épuise avant, c’est la plus longue frise qui l’emporte, départagée aux jetons.',
    ],
  },
];

/** The four cards shown to a table that has never played before. */
export const ONBOARDING: { emoji: string; title: string; body: string }[] = [
  {
    emoji: '🔊',
    title: 'Une seule enceinte',
    body: 'La musique sort de l’enceinte de l’hôte via Spotify. Posez le téléphone de l’hôte écran vers le bas : l’app Spotify affiche le titre et l’année.',
  },
  {
    emoji: '📱',
    title: 'Un téléphone chacun',
    body: 'Chacun scanne le QR code et entre son prénom. Rien à installer, aucun compte à créer.',
  },
  {
    emoji: '🎴',
    title: 'L’arbitre tire la carte',
    body: 'À chaque tour, ton voisin de gauche tire la carte et lance la musique. Toi, tu écoutes — tu ne touches à rien qui puisse te trahir.',
  },
  {
    emoji: '🎧',
    title: 'Écouter, puis placer',
    body: 'À ton tour, place le morceau dans ta frise. Les autres écoutent et guettent l’erreur.',
  },
  {
    emoji: '⚡',
    title: 'Guetter les erreurs',
    body: 'Un jeton dépensé au bon moment vole la carte d’un adversaire. C’est là que le jeu se joue.',
  },
];
