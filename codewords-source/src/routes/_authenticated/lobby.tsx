import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { clueEfficiency, operativeAccuracy, operativeScore, spymasterScore, winRate } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/lobby")({
  head: () => ({
    meta: [
      { title: "Play — Codewords" },
      { name: "description", content: "Create a game room or join your friends with a code." },
      { property: "og:title", content: "Play — Codewords" },
      { property: "og:description", content: "Create a game room or join your friends with a code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me", user.id],
    queryFn: async () => {
      const [{ data: profile }, { data: stats }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("player_stats").select("*").eq("user_id", user.id).single(),
      ]);
      return { profile, stats };
    },
  });

  async function create() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_game");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/game/$code", params: { code: data } });
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("join_game", { _code: code });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/game/$code", params: { code: data } });
  }

  const s = me?.stats;
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Welcome back, agent</p>
        <h1 className="mt-2 font-display text-4xl">{me?.profile?.username ?? "…"}</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-sm border-2 border-foreground/80 bg-card p-5">
            <h2 className="font-display text-lg">New game</h2>
            <p className="mt-1 text-sm text-muted-foreground">Get a room code to share with friends.</p>
            <Button className="mt-4 w-full" onClick={create} disabled={busy}>Create room</Button>
          </div>
          <form onSubmit={join} className="rounded-sm border-2 border-foreground/80 bg-card p-5">
            <h2 className="font-display text-lg">Join a game</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter the 5-letter code.</p>
            <div className="mt-4 flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" className="font-mono uppercase tracking-widest" required />
              <Button type="submit" disabled={busy}>Join</Button>
            </div>
          </form>
        </div>

        {s && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <StatCard
              title="As operative"
              score={operativeScore(s)}
              rows={[
                ["Games played", s.op_games],
                ["Win rate", `${winRate(s.op_wins, s.op_games)}%`],
                ["Correct picks", s.op_correct],
                ["Accuracy", `${operativeAccuracy(s)}%`],
                ["Assassin hits", s.op_assassin],
              ]}
            />
            <StatCard
              title="As spymaster"
              score={spymasterScore(s)}
              rows={[
                ["Games played", s.sm_games],
                ["Win rate", `${winRate(s.sm_wins, s.sm_games)}%`],
                ["Clues given", s.sm_clues],
                ["Cards per clue", clueEfficiency(s)],
                ["Assassin losses", s.sm_assassin],
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, score, rows }: { title: string; score: number; rows: [string, string | number][] }) {
  return (
    <div className="rounded-sm border-2 border-foreground/80 bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg">{title}</h3>
        <span className="font-mono text-2xl font-semibold">{score} pts</span>
      </div>
      <dl className="mt-3 divide-y divide-border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
