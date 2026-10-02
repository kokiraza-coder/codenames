import { useCallback, useEffect, useState } from 'react';
import { Home } from './screens/Home.tsx';
import { RoomScreen } from './screens/RoomScreen.tsx';
import { NAME_KEY } from './lib/useRoom.ts';

/** Room code from /room/XKCD, or null on the home screen. */
function readRoomFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{4,8})\/?$/);
  return match ? match[1]!.toUpperCase() : null;
}

/**
 * Routing is one regex because there are exactly two screens. Pulling in a
 * router would cost more bytes than the whole lobby.
 */
export function App() {
  const [roomCode, setRoomCode] = useState<string | null>(readRoomFromUrl);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');

  // Back/forward should move between the lobby and a room.
  useEffect(() => {
    const onPop = () => setRoomCode(readRoomFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const updateName = useCallback((value: string) => {
    setName(value);
    localStorage.setItem(NAME_KEY, value);
  }, []);

  const enterRoom = useCallback((code: string) => {
    window.history.pushState({}, '', `/room/${code}`);
    setRoomCode(code);
  }, []);

  const leaveRoom = useCallback(() => {
    window.history.pushState({}, '', '/');
    setRoomCode(null);
  }, []);

  // A shared link lands on a room before the visitor has picked a name.
  if (roomCode && name.trim().length === 0) {
    return (
      <Home
        name={name}
        onNameChange={updateName}
        onEnterRoom={enterRoom}
      />
    );
  }

  if (roomCode) {
    return (
      <RoomScreen
        key={roomCode}
        roomCode={roomCode}
        name={name.trim()}
        onLeave={leaveRoom}
      />
    );
  }

  return <Home name={name} onNameChange={updateName} onEnterRoom={enterRoom} />;
}
