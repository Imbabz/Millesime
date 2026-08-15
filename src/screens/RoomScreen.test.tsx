import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomScreen } from './RoomScreen';

/**
 * A full turn, driven through the real interface.
 *
 * `mock` mode gives a local transport, a fake speaker and a seeded table, so
 * this exercises the actual components, the actual reducer and the actual
 * session wiring — everything except the network and Spotify. It is the test
 * that would catch a screen wired to the wrong action, which no amount of
 * reducer coverage can.
 *
 * It also runs single-device, so the one phone stands in for whoever the
 * current phase concerns — which is how the demo mode and the "jouer sur ce
 * seul téléphone" room actually work.
 */

const renderRoom = () =>
  render(
    <RoomScreen
      code="LOCAL"
      role="host"
      mock
      onLeave={() => {}}
      onOpenConfig={() => {}}
    />,
  );

/** A real one-phone room: no seeded table, no mock harness. */
const renderLocalRoom = () =>
  render(
    <RoomScreen
      code="LOCAL"
      role="host"
      mock={false}
      onLeave={() => {}}
      onOpenConfig={() => {}}
    />,
  );

describe('a table sharing one phone', () => {
  it('fills the seats from the lobby, without asking who is holding it', async () => {
    const user = userEvent.setup();
    renderLocalRoom();

    // No "prends ta place" detour: that seated the owner and then left no way
    // to add anybody else.
    const field = await screen.findByLabelText('Prénom du joueur à ajouter');
    for (const name of ['Alex', 'Bob', 'Chloé']) {
      await user.type(field, name);
      await user.click(screen.getByRole('button', { name: '+ Ajouter' }));
    }

    expect(screen.getByText('Alex')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Chloé')).toBeDefined();
    expect(screen.getByText(/Joueurs \(3\//)).toBeDefined();

    // Seating order is the table's order, so the arbiter lands on the left.
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));
    await screen.findByText('Tire la carte pour Alex');
  });

  it('lets a seat be removed and the name reused', async () => {
    const user = userEvent.setup();
    renderLocalRoom();
    const field = await screen.findByLabelText('Prénom du joueur à ajouter');

    await user.type(field, 'Alex');
    await user.click(screen.getByRole('button', { name: '+ Ajouter' }));
    await user.click(screen.getByRole('button', { name: 'Retirer' }));

    expect(screen.queryByText('Alex')).toBeNull();
    await user.type(field, 'Alex');
    await user.click(screen.getByRole('button', { name: '+ Ajouter' }));
    expect(screen.getByText('Alex')).toBeDefined();
  });
});

describe('a game, played through the UI', () => {
  it('seats the simulated table and shows the deck size', async () => {
    renderRoom();
    await screen.findByText('Alex');
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Chloé')).toBeDefined();
    expect(screen.getByText('Dimitri')).toBeDefined();
    await waitFor(() => expect(screen.getByText(/cartes disponibles/)).toBeDefined());
  });

  it('refuses to start on a selection too thin to seat everyone', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Alex');

    await user.click(screen.getByRole('button', { name: '50s' }));
    await user.click(screen.getByRole('button', { name: 'Piège à dater' }));

    await waitFor(() =>
      expect(screen.getByText(/il en faut au moins/)).toBeDefined(),
    );
    expect(
      screen.getByRole('button', { name: /Lancer la partie/ }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('gives the draw to the arbiter, not to the player who has to guess', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Alex');
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));

    // Alex plays the first turn, so his neighbour Bob draws for him. On one
    // device that means the phone is handed to Bob.
    await screen.findByText(/Le téléphone est à/);
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Tire la carte pour Alex')).toBeDefined();
    expect(screen.getByRole('button', { name: /Tirer la carte/ })).toBeDefined();
  });

  it('runs a turn from the draw through to the reveal, rotating the arbiter', async () => {
    const user = userEvent.setup();
    const { container } = renderRoom();
    await screen.findByText('Alex');

    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));

    await user.click(await screen.findByRole('button', { name: /Tirer la carte/ }));
    await screen.findByText('Où se range ce morceau ?');
    expect(
      screen.getByRole('button', { name: 'Choisis un emplacement' }).hasAttribute('disabled'),
    ).toBe(true);

    // One card on the timeline means two gaps to choose between.
    const gaps = screen.getAllByRole('button', { name: /^Placer/ });
    expect(gaps).toHaveLength(2);
    await user.click(gaps[0] as HTMLElement);

    await user.click(screen.getByRole('button', { name: 'Valider ce placement' }));

    // Everyone is dealt a token, so the steal window opens on the very first
    // turn and the phone goes round the table one opponent at a time. Three
    // opponents, three refusals, and only then the reveal.
    for (let opponent = 0; opponent < 3; opponent += 1) {
      await user.click(await screen.findByRole('button', { name: 'Laisser passer' }));
    }

    await screen.findByText(/Bien joué|Personne ne l’a placée/);
    // Timeline cards also show years, so target the reveal card itself.
    const year = container.querySelector('.reveal-card__year');
    expect(Number(year?.textContent)).toBeGreaterThan(1900);

    await user.click(screen.getByRole('button', { name: 'Joueur suivant' }));
    // The turn moves on and the arbiter moves with it: Bob plays, Chloé draws.
    await screen.findByText('Tire la carte pour Bob');
  });

  it('opens a one-phone room without the steal timer', async () => {
    renderRoom();
    await screen.findByText('Alex');
    // Ten seconds cannot go round a table one phone at a time, so the window
    // waits for everyone instead of counting down.
    await waitFor(() => expect(screen.getByText('0s')).toBeDefined());
  });

  it('shows the scoreboard, and restarts back into the settings', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Alex');
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));
    await screen.findByRole('button', { name: /Tirer la carte/ });

    await user.click(screen.getByRole('button', { name: 'Scores et réglages' }));
    await screen.findByText('Scores');
    expect(screen.getByText(/objectif 10 cartes/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Recommencer/ }));
    await user.click(screen.getByRole('button', { name: 'Oui, recommencer' }));

    // Back in the lobby, where every setting lives and the table is still sat.
    await screen.findByRole('button', { name: /Lancer la partie/ });
    expect(screen.getByText('Chloé')).toBeDefined();
  });

  it('lets the arbiter hand out a token from the draw screen', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Alex');
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));
    await screen.findByRole('button', { name: /Tirer la carte/ });

    // Four players, one token each to start with.
    expect(screen.getAllByTitle('1 jeton')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: /Donner un jeton/ }));
    // The list is in seating order, so the first +1 goes to Alex.
    await user.click(screen.getAllByRole('button', { name: '+1' })[0] as HTMLElement);

    await waitFor(() => expect(screen.getByTitle('2 jetons')).toBeDefined());
    expect(screen.getAllByTitle('1 jeton')).toHaveLength(3);
  });

  it('starts the music on the draw, and lets it be paused', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Alex');
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));

    // Nothing plays until the arbiter draws — that is the whole point of the
    // extra beat.
    expect(screen.queryByRole('button', { name: /Pause/ })).toBeNull();

    await user.click(await screen.findByRole('button', { name: /Tirer la carte/ }));
    const pause = await screen.findByRole('button', { name: /Pause/ });
    await user.click(pause);
    await screen.findByRole('button', { name: /Reprendre/ });
  });

  it('offers the rules from inside the game without leaving it', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Alex');

    await user.click(screen.getByRole('button', { name: 'Les règles' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('⚡ Voler une carte')).toBeDefined();
    expect(within(dialog).getByText('🎴 L’arbitre du tour')).toBeDefined();

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Still in the lobby: the rules never cost anyone their place.
    expect(screen.getByText('Alex')).toBeDefined();
  });
});
