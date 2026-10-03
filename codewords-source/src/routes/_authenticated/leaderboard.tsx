import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  clueEfficiency, operativeAccuracy, operativeScore, spymasterScore, winRate, SCORING_RULES, type PlayerStats,
} from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Scoreboard — Codewords" },
      { name: "description", content: "Leaderboards for operatives and spymasters: games played, wins and points." },
      { property: "og:title", content: "Scoreboard — Codewords" },
      { property: "og:description", content: "Leaderboards for operatives and spymasters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leaderboard,
});

type Row = PlayerStats & { username: string };

function Leaderboard() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"operative" | "spymaster" | "overall">("overall");
  const { data = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: stats }, { data: profiles }] = await Promise.all([
        supabase.from("player_stats").select("*"),
        supabase.from("profiles").select("id, username"),
      ]);
      const names = new Map((profiles ?? []).map((p) => [p.id, p.username]));
      return (stats ?? []).map((s) => ({ ...s, username: names.get(s.user_id) ?? "Agent" }));
    },
  });

  const rows = [...data]
    .map((r) => ({
      r,
      op: operativeScore(r),
      sm: spymasterScore(r),
      games: r.op_games + r.sm_games,
      wins: r.op_wins + r.sm_wins,
    }))
    .filter((x) => (tab === "operative" ? x.r.op_games > 0 : tab === "spymaster" ? x.r.sm_games > 0 : x.games > 0))
    .sort((a, b) => (tab === "operative" ? b.op - a.op : tab === "spymaster" ? b.sm - a.sm : b.op + b.sm - (a.op + a.sm)));

  const tabs = [
    ["overall", "Overall"],
    ["operative", "Operatives"],
    ["spymaster", "Spymasters"],
  ] as const;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-4xl">Scoreboard</h1>
        <div className="mt-6 flex gap-1 border-b-2 border-foreground/80">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== "overall" && <p className="mt-3 font-mono text-xs text-muted-foreground">{SCORING_RULES[tab]}</p>}

        <div className="mt-4 overflow-x-auto rounded-sm border-2 border-foreground/80 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left font-mono text-xs uppercase">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Player</th>
                {tab === "overall" && (<><th className="p-3">Games</th><th className="p-3">Wins</th><th className="p-3">Win %</th><th className="p-3">Operative pts</th><th className="p-3">Spymaster pts</th><th className="p-3">Total</th></>)}
                {tab === "operative" && (<><th className="p-3">Games</th><th className="p-3">Win %</th><th className="p-3">Correct</th><th className="p-3">Accuracy</th><th className="p-3">Assassin</th><th className="p-3">Points</th></>)}
                {tab === "spymaster" && (<><th className="p-3">Games</th><th className="p-3">Win %</th><th className="p-3">Clues</th><th className="p-3">Cards/clue</th><th className="p-3">Assassin</th><th className="p-3">Points</th></>)}
              </tr>
            </thead>
            <tbody className="font-mono">
              {isLoading && <tr><td className="p-4" colSpan={8}>Loading…</td></tr>}
              {!isLoading && rows.length === 0 && (
                <tr><td className="p-4 font-sans text-muted-foreground" colSpan={8}>No finished games yet. Play one to get on the board.</td></tr>
              )}
              {rows.map(({ r, op, sm, games, wins }, i) => (
                <tr key={r.user_id} className={`border-t border-border ${r.user_id === user.id ? "bg-accent" : ""}`}>
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3 font-sans font-semibold">{r.username}</td>
                  {tab === "overall" && (<><td className="p-3">{games}</td><td className="p-3">{wins}</td><td className="p-3">{winRate(wins, games)}%</td><td className="p-3">{op}</td><td className="p-3">{sm}</td><td className="p-3 font-semibold">{op + sm}</td></>)}
                  {tab === "operative" && (<><td className="p-3">{r.op_games}</td><td className="p-3">{winRate(r.op_wins, r.op_games)}%</td><td className="p-3">{r.op_correct}</td><td className="p-3">{operativeAccuracy(r)}%</td><td className="p-3">{r.op_assassin}</td><td className="p-3 font-semibold">{op}</td></>)}
                  {tab === "spymaster" && (<><td className="p-3">{r.sm_games}</td><td className="p-3">{winRate(r.sm_wins, r.sm_games)}%</td><td className="p-3">{r.sm_clues}</td><td className="p-3">{clueEfficiency(r)}</td><td className="p-3">{r.sm_assassin}</td><td className="p-3 font-semibold">{sm}</td></>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
