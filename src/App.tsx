import { useEffect, useState } from 'react';
import { loadConfig } from '@/config';
import { completeLogin } from '@/spotify/auth';
import { newRoomCode, normaliseRoomCode } from '@/session/room';
import { playerId, setPlayerName } from '@/session/identity';
import { Banner } from '@/ui/bits';
import { HomeScreen } from '@/screens/HomeScreen';
import { JoinScreen } from '@/screens/JoinScreen';
import { ConfigScreen } from '@/screens/ConfigScreen';
import { RoomScreen } from '@/screens/RoomScreen';

/**
 * Hash routing, hand-rolled.
 *
 * Hash routes rather than paths because the app is a static bundle with no
 * server to rewrite requests: a deep link to `/room/ABCD` would 404 on any host
 * that has not been told otherwise. `#/join/ABCD` survives everywhere, which
 * matters — that string is what the QR code contains, and a guest scanning it
 * has no second chance.
 */
type Route =
  | { name: 'home' }
  | { name: 'join'; code: string }
  | { name: 'room'; code: string }
  | { name: 'config' };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, tail] = path.split('/');
  if (head === 'join' && tail) return { name: 'join', code: normaliseRoomCode(tail) };
  if (head === 'room' && tail) {
    return { name: 'room', code: tail === 'LOCAL' ? 'LOCAL' : normaliseRoomCode(tail) };
  }
  if (head === 'config') return { name: 'config' };
  return { name: 'home' };
}

const navigate = (hash: string) => {
  window.location.hash = hash;
};

/** Rooms this device created, so a refresh does not demote the host to a guest. */
const HOSTED_KEY = 'millesime.hosted';

const hostedRooms = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HOSTED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

const rememberHosted = (code: string) => {
  const rooms = new Set(hostedRooms());
  rooms.add(code);
  localStorage.setItem(HOSTED_KEY, JSON.stringify([...rooms].slice(-10)));
};

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [authError, setAuthError] = useState<string | null>(null);
  const mock = new URLSearchParams(window.location.search).has('dev');

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Spotify sends the host back here with a `?code=`; consume it before
  // anything else can read the URL.
  useEffect(() => {
    const clientId = loadConfig().spotifyClientId;
    if (!clientId) return;
    void completeLogin(clientId).then((result) => {
      if (result && !result.ok) setAuthError(result.error);
      setRoute(parseHash(window.location.hash));
    });
  }, []);

  const startRoom = (code: string) => {
    rememberHosted(code);
    navigate(`#/room/${code}`);
  };

  if (route.name === 'config') {
    return <ConfigScreen onBack={() => navigate('#/')} />;
  }

  if (route.name === 'join') {
    return (
      <JoinScreen
        code={route.code}
        onBack={() => navigate('#/')}
        onEnter={(name) => {
          setPlayerName(name);
          navigate(`#/room/${route.code}`);
        }}
      />
    );
  }

  if (route.name === 'room') {
    const isHost = mock || route.code === 'LOCAL' || hostedRooms().includes(route.code);
    return (
      <RoomScreen
        // Remounting on a room change is intentional: a new room means a new
        // transport, a new board and no leftover state from the last one.
        key={`${route.code}-${playerId()}`}
        code={route.code}
        role={isHost ? 'host' : 'guest'}
        mock={mock}
        onLeave={() => navigate('#/')}
        onOpenConfig={() => navigate('#/config')}
      />
    );
  }

  return (
    <>
      {authError && (
        <div style={{ padding: '16px 16px 0' }}>
          <Banner tone="error">{authError}</Banner>
        </div>
      )}
      <HomeScreen
        onCreate={() => startRoom(newRoomCode())}
        onJoin={(code) => navigate(`#/join/${code}`)}
        onLocal={() => startRoom('LOCAL')}
        onConfig={() => navigate('#/config')}
      />
    </>
  );
}
