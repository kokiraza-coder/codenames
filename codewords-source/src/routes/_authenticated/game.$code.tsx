import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/game/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Codewords` },
      { name: "description", content: "A live Codewords game room." },
      { property: "og:title", content: `Room ${params.code} — Codewords` },
      { property: "og:description", content: "Join this Codewords game room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamePage,
});

const tone: Record<string, string> = {
  red: "bg-team-red text-team-red-foreground",
  blue: "bg-team-blue text-team-blue-foreground",
  bystander: "bg-bystander text-bystander-foreground",
  assassin: "bg-assassin text-assassin-foreground",
};
const ring: Record<string, string> = {
  red: "ring-4 ring-inset ring-team-red",
  blue: "ring-4 ring-inset ring-team-blue",
  bystander: "ring-4 ring-inset ring-bystander",
  assassin: "ring-4 ring-inset ring-assassin",
};

function GamePage() {
  const { code } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["game", code];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: game } = await supabase.from("games").select("*").eq("code", code).maybeSingle();
      if (!game) return null;
      const [players, cards, keys, clues] = await Promise.all([
        supabase.from("game_players").select("*, profiles(username)").eq("game_id", game.id),
        supabase.from("cards").select("*").eq("game_id", game.id).order("idx"),
        supabase.from("card_keys").select("*").eq("game_id", game.id),
        supabase.from("clues").select("*").eq("game_id", game.id).order("created_at"),
      ]);
      return {
        game,
        players: players.data ?? [],
        cards: cards.data ?? [],
        keys: new Map((keys.data ?? []).map((k) => [k.idx, k.kind])),
        clues: clues.data ?? [],
      };
    },
  });

  const gameId = data?.game.id;
  useEffect(() => {
    if (!gameId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: key });
    const ch = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "clues", filter: `game_id=eq.${gameId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const [clue, setClue] = useState("");
  const [count, setCount] = useState("1");

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  if (isLoading) return <Shell><p>Loading…</p></Shell>;
  if (!data) return <Shell><p>No game with code {code}. <Link to="/lobby" className="underline">Back</Link></p></Shell>;

  const { game, players, cards, keys, clues } = data;
  const me = players.find((p) => p.user_id === user.id);
  const isHost = game.host_id === user.id;
  const remaining = (team: string) => cards.filter((c) => keys.get(c.idx) === team && !c.revealed).length ||
    (keys.size ? 0 : (game.starting_team === team ? 9 : 8) - cards.filter((c) => c.revealed_kind === team).length);
  const myTurnSpy = game.status === "playing" && game.phase === "clue" && me?.role === "spymaster" && me.team === game.current_team;
  const myTurnOp = game.status === "playing" && game.phase === "guess" && me?.role === "operative" && me.team === game.current_team;

  if (!me) {
    return (
      <Shell>
        <p>You're not in this room.</p>
        {game.status === "lobby" && <Button className="mt-4" onClick={() => run(supabase.rpc("join_game", { _code: code }))}>Join room</Button>}
      </Shell>
    );
  }

  if (game.status === "lobby") {
    return (
      <Shell>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Room code</p>
        <h1 className="font-display text-5xl tracking-widest">{game.code}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Share this code. Each team needs one spymaster and at least one operative.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(["red", "blue"] as const).map((team) => (
            <div key={team} className={`rounded-sm border-2 border-foreground/80 p-4 ${tone[team]}`}>
              <h2 className="font-display text-xl uppercase">{team} team</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {players.filter((p) => p.team === team).map((p) => (
                  <li key={p.user_id}>{p.profiles?.username} · <span className="font-mono text-xs uppercase">{p.role}</span></li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => run(supabase.rpc("choose_seat", { _game: game.id, _team: team, _role: "operative" }))}>Be operative</Button>
                <Button size="sm" variant="secondary" onClick={() => run(supabase.rpc("choose_seat", { _game: game.id, _team: team, _role: "spymaster" }))}>Be spymaster</Button>
              </div>
            </div>
          ))}
        </div>
        {isHost ? (
          <Button size="lg" className="mt-6" onClick={() => run(supabase.rpc("start_game", { _game: game.id }))}>Start game</Button>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Waiting for the host to start…</p>
        )}
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 font-display text-2xl">
          <span className="text-team-red">{remaining("red")}</span>
          <span>–</span>
          <span className="text-team-blue">{remaining("blue")}</span>
        </div>
        <div className="text-right text-sm">
          {game.status === "finished" ? (
            <p className="font-display text-xl uppercase">
              <span className={game.winner === "red" ? "text-team-red" : "text-team-blue"}>{game.winner}</span> wins
              {game.win_reason === "assassin" && " — assassin hit!"}
            </p>
          ) : (
            <p>
              <span className={`font-semibold uppercase ${game.current_team === "red" ? "text-team-red" : "text-team-blue"}`}>{game.current_team}</span>{" "}
              {game.phase === "clue" ? "spymaster is thinking…" : <>guessing · clue <b className="font-mono">{game.clue_word} {game.clue_count}</b> · {game.guesses_left} guesses left</>}
            </p>
          )}
          <p className="text-xs text-muted-foreground">You are {me.team} {me.role}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
        {cards.map((c) => {
          const secret = keys.get(c.idx);
          const cls = c.revealed ? tone[c.revealed_kind ?? ""] : `bg-tile text-tile-foreground ${secret ? ring[secret] : ""}`;
          return (
            <button
              key={c.idx}
              disabled={!myTurnOp || c.revealed}
              onClick={() => run(supabase.rpc("make_guess", { _game: game.id, _idx: c.idx }))}
              className={`flex aspect-[4/3] items-center justify-center rounded-sm border-2 border-foreground/70 p-1 font-mono text-[9px] font-semibold break-all sm:text-sm ${cls} ${c.revealed ? "opacity-80" : ""} ${myTurnOp && !c.revealed ? "hover:-translate-y-0.5 cursor-pointer" : ""}`}
            >
              {c.word}
            </button>
          );
        })}
      </div>

      {myTurnSpy && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(supabase.rpc("give_clue", { _game: game.id, _word: clue, _count: Number(count) }));
            setClue("");
          }}
        >
          <Input placeholder="One-word clue" value={clue} onChange={(e) => setClue(e.target.value)} required />
          <Input type="number" min={0} max={9} className="w-20" value={count} onChange={(e) => setCount(e.target.value)} />
          <Button type="submit">Give clue</Button>
        </form>
      )}
      {myTurnOp && (
        <Button variant="outline" className="mt-4" onClick={() => run(supabase.rpc("end_turn", { _game: game.id }))}>End turn</Button>
      )}

      {clues.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg">Clue log</h2>
          <ul className="mt-2 flex flex-wrap gap-2 font-mono text-xs">
            {clues.map((c) => (
              <li key={c.id} className={`rounded-sm px-2 py-1 ${tone[c.team]}`}>{c.word} {c.count}</li>
            ))}
          </ul>
        </div>
      )}
      {game.status === "finished" && (
        <div className="mt-6 flex gap-2">
          <Button asChild><Link to="/lobby">New game</Link></Button>
          <Button variant="outline" asChild><Link to="/leaderboard">Scoreboard</Link></Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className={`mx-auto px-3 py-8 ${wide ? "max-w-4xl" : "max-w-2xl"}`}>{children}</main>
    </div>
  );
}
