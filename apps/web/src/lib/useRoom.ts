import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientGameState, Role, Ruleset, Team } from '@codenames/engine';
import type { ChatMessage, ErrorPayload } from '@codenames/protocol';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

/** Seat identity survives a refresh, which is what makes reconnect seamless. */
const seatKey = (roomCode: string) => `codenames:seat:${roomCode}`;
export const NAME_KEY = 'codenames:name';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export type Room = {
  status: ConnectionStatus;
  state: ClientGameState | null;
  chat: ChatMessage[];
  /** Last rejection from the server, cleared automatically after a moment. */
  error: ErrorPayload | null;
  /** Index the local player has clicked but the server has not confirmed. */
  pendingGuess: number | null;
  me: ClientGameState['players'][number] | null;

  setTeam: (team: Team | null) => void;
  setRole: (role: Role) => void;
  setName: (name: string) => void;
  setRuleset: (ruleset: Ruleset) => void;
  start: () => void;
  giveClue: (word: string, count: number) => void;
  guess: (cardIndex: number) => void;
  pass: () => void;
  rematch: () => void;
  sendChat: (text: string) => void;
  leave: () => void;
};

export function useRoom(roomCode: string, name: string): Room {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [state, setState] = useState<ClientGameState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<ErrorPayload | null>(null);
  const [pendingGuess, setPendingGuess] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  // Keep the latest name in a ref so reconnects use it without re-opening the
  // socket every keystroke.
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (!roomCode || !name) return;

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 300,
      reconnectionDelayMax: 2000,
    });
    socketRef.current = socket;

    const announce = () => {
      const saved = localStorage.getItem(seatKey(roomCode)) ?? undefined;
      socket.emit('room:join', { roomCode, name: nameRef.current, playerId: saved });
    };

    socket.on('connect', () => {
      setStatus('connected');
      announce();
    });
    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    socket.on('disconnect', () => setStatus('reconnecting'));
    socket.on('connect_error', () => setStatus('error'));

    socket.on('room:joined', (payload: { playerId: string }) => {
      localStorage.setItem(seatKey(roomCode), payload.playerId);
      setPlayerId(payload.playerId);
    });

    socket.on('room:state', (next: ClientGameState) => {
      // Frames can arrive out of order after a reconnect; keep the newest.
      setState((prev) => (prev && next.version < prev.version ? prev : next));
      // Any confirmed state means our optimistic click resolved, one way or
      // the other — the server is the authority on what actually happened.
      setPendingGuess(null);
    });

    socket.on('chat:message', (message: ChatMessage) => {
      setChat((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });

    socket.on('error', (payload: ErrorPayload) => {
      setError(payload);
      setPendingGuess(null);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, name]);

  // Errors are transient nudges, not modal state.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const emit = useCallback((event: string, payload: unknown = {}) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const guess = useCallback(
    (cardIndex: number) => {
      // We cannot flip the card optimistically — only the server knows the
      // colour — so show it as pressed immediately and let the reveal land
      // when the authoritative state arrives.
      setPendingGuess(cardIndex);
      emit('game:guess', { cardIndex });
    },
    [emit],
  );

  const me = useMemo(
    () => state?.players.find((p) => p.id === playerId) ?? null,
    [state, playerId],
  );

  return useMemo(
    () => ({
      status,
      state,
      chat,
      error,
      pendingGuess,
      me,
      setTeam: (team) => emit('lobby:setTeam', { team }),
      setRole: (role) => emit('lobby:setRole', { role }),
      setName: (value) => emit('lobby:setName', { name: value }),
      setRuleset: (ruleset) => emit('lobby:setRuleset', { ruleset }),
      start: () => emit('game:start'),
      giveClue: (word, count) => emit('game:giveClue', { word, count }),
      guess,
      pass: () => emit('game:pass'),
      rematch: () => emit('game:rematch'),
      sendChat: (text) => emit('chat:send', { text }),
      leave: () => emit('room:leave'),
    }),
    [status, state, chat, error, pendingGuess, me, emit, guess],
  );
}
