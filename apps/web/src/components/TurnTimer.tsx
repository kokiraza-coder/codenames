import { useEffect, useState } from 'react';

type Props = { deadline: number | null };

/**
 * The server owns the deadline and ends the turn itself; this is purely a
 * readout, so a slow client can never gain or lose time.
 */
export function TurnTimer({ deadline }: Props) {
  const [remaining, setRemaining] = useState(() => msLeft(deadline));

  useEffect(() => {
    if (deadline === null) return;
    setRemaining(msLeft(deadline));
    const id = setInterval(() => setRemaining(msLeft(deadline)), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return null;

  const seconds = Math.ceil(remaining / 1000);
  const urgent = seconds <= 10;

  return (
    <span
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      className={`tabular-nums text-sm ${urgent ? 'text-agent-red' : 'text-neutral-400'}`}
    >
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  );
}

const msLeft = (deadline: number | null) =>
  deadline === null ? 0 : Math.max(0, deadline - Date.now());
