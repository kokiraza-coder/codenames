import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Codewords — play the word spy game with friends" },
      { name: "description", content: "A Codenames-style party game with accounts and separate spymaster and operative scoreboards." },
      { property: "og:title", content: "Codewords — play the word spy game with friends" },
      { property: "og:description", content: "Log in, play with friends, and track spymaster and operative scores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const demo = [
  ["SPY", "red"], ["MOON", "tile"], ["BANK", "blue"], ["PIRATE", "tile"], ["ICE", "bystander"],
  ["KEY", "tile"], ["LONDON", "red"], ["GHOST", "assassin"], ["NET", "tile"], ["WHALE", "blue"],
] as const;

const tone: Record<string, string> = {
  red: "bg-team-red text-team-red-foreground",
  blue: "bg-team-blue text-team-blue-foreground",
  bystander: "bg-bystander text-bystander-foreground",
  assassin: "bg-assassin text-assassin-foreground",
  tile: "bg-tile text-tile-foreground",
};

function Index() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Classified · Party game</p>
            <h1 className="mt-4 font-display text-5xl leading-[0.95] sm:text-7xl">
              One word.<br />Your team.<br /><span className="text-team-red">No mistakes.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Play with friends from your own accounts. Every guess and every clue is scored — so you'll finally know
              who's the best spymaster and who's the sharpest operative.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link to="/lobby">Start or join a game</Link></Button>
              <Button size="lg" variant="outline" asChild><Link to="/leaderboard">See the scoreboard</Link></Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 rotate-1">
            {demo.map(([w, t]) => (
              <div key={w} className={`flex aspect-[4/3] items-center justify-center rounded-sm border-2 border-foreground/70 font-mono text-[10px] font-semibold sm:text-sm ${tone[t]}`}>
                {w}
              </div>
            ))}
          </div>
        </div>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            ["01 · Create a room", "Get a 5-letter code and share it. Friends sign in and join."],
            ["02 · Pick your seat", "Red or blue. One spymaster per team, everyone else is an operative."],
            ["03 · Get scored", "Operatives earn points for correct picks; spymasters for cards their clues clear."],
          ].map(([t, d]) => (
            <div key={t} className="border-t-2 border-foreground/80 pt-4">
              <h2 className="font-display text-lg">{t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
