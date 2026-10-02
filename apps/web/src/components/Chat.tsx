import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@codenames/protocol';

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

export function Chat({ messages, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (text.length === 0) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-felt-700 bg-felt-900/60">
      <h2 className="border-b border-felt-700 px-3 py-2 text-xs uppercase tracking-widest text-neutral-500">
        Chat
      </h2>
      <div ref={scroller} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && <p className="text-neutral-600">Say hello.</p>}
        {messages.map((m) => (
          <p key={m.id}>
            <span
              className={
                m.team === 'red'
                  ? 'text-agent-red'
                  : m.team === 'blue'
                    ? 'text-agent-blue'
                    : 'text-neutral-400'
              }
            >
              {m.name}
            </span>
            <span className="text-neutral-500">: </span>
            <span className="text-neutral-200">{m.text}</span>
          </p>
        ))}
      </div>
      <div className="flex gap-1.5 border-t border-felt-700 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Message"
          maxLength={300}
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-md border border-felt-700 bg-felt-900 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-agent-blue/40"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-md border border-felt-700 px-2 py-1 text-sm hover:bg-felt-700"
        >
          Send
        </button>
      </div>
    </section>
  );
}
