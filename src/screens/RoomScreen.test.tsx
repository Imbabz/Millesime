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

describe('a game, played through the UI', () => {
  it('seats the simulated table and shows the deck size', async () => {
    renderRoom();
    await screen.findByText('Toi');
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Chloé')).toBeDefined();
    expect(screen.getByText('Dimitri')).toBeDefined();
    await waitFor(() => expect(screen.getByText(/cartes disponibles/)).toBeDefined());
  });

  it('refuses to start on a selection too thin to seat everyone', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Toi');

    await user.click(screen.getByRole('button', { name: '50s' }));
    await user.click(screen.getByRole('button', { name: 'Piège à dater' }));

    await waitFor(() =>
      expect(screen.getByText(/il en faut au moins/)).toBeDefined(),
    );
    expect(
      screen.getByRole('button', { name: /Lancer la partie/ }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('hands the draw to the arbiter, never to the player who has to guess', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Toi');
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));

    // We hold the first seat, so our neighbour Bob is the arbiter and the
    // draw button must not be on our screen.
    await screen.findByText('Bob tire la carte');
    expect(screen.queryByRole('button', { name: /Tirer la carte/ })).toBeNull();
    expect(screen.getByText(/Ne touche à rien/)).toBeDefined();
  });

  it('runs a turn from placement through the steal window to the reveal', async () => {
    const user = userEvent.setup();
    const { container } = renderRoom();
    await screen.findByText('Toi');

    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));

    // The simulated arbiter draws for us, then the placement is ours.
    await screen.findByText('Où se range ce morceau ?', undefined, { timeout: 4000 });
    expect(
      screen.getByRole('button', { name: 'Choisis un emplacement' }).hasAttribute('disabled'),
    ).toBe(true);

    // One card on the timeline means two gaps to choose between.
    const gaps = screen.getAllByRole('button', { name: /^Placer/ });
    expect(gaps).toHaveLength(2);
    await user.click(gaps[0] as HTMLElement);

    await user.click(screen.getByRole('button', { name: 'Valider ce placement' }));

    // Nobody holds a token on the first turn, so there is nothing to steal
    // with and the game goes straight to the reveal.
    await screen.findByText(/Bien joué|Personne ne l’a placée/);
    // Timeline cards also show years, so target the reveal card itself.
    const year = container.querySelector('.reveal-card__year');
    expect(Number(year?.textContent)).toBeGreaterThan(1900);

    await user.click(screen.getByRole('button', { name: 'Joueur suivant' }));
    // The turn moves on, and so does the arbiter: Bob plays, Chloé now draws.
    await screen.findByText('Chloé tire la carte');
  });

  it('lets any phone pause and resume the music', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Toi');
    await user.click(screen.getByRole('button', { name: /Lancer la partie/ }));

    // The mock speaker starts once the card has been drawn.
    const pause = await screen.findByRole(
      'button',
      { name: /Pause/ },
      { timeout: 4000 },
    );
    await user.click(pause);
    await screen.findByRole('button', { name: /Reprendre/ });
  });

  it('offers the rules from inside the game without leaving it', async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByText('Toi');

    await user.click(screen.getByRole('button', { name: 'Les règles' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('⚡ Voler une carte')).toBeDefined();

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Still in the lobby: the rules never cost anyone their place.
    expect(screen.getByText('Toi')).toBeDefined();
  });
});
