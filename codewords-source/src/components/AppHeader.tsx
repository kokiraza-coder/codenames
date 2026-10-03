import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session";

export function AppHeader() {
  const { user, ready } = useSessionUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b-2 border-foreground/80 bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="font-display text-xl tracking-wide">
          CODE<span className="text-team-red">WORDS</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          {user && (
            <>
              <Link to="/lobby" className="px-2 py-1 font-medium hover:underline" activeProps={{ className: "underline" }}>
                Play
              </Link>
              <Link to="/leaderboard" className="px-2 py-1 font-medium hover:underline" activeProps={{ className: "underline" }}>
                Scoreboard
              </Link>
            </>
          )}
          {ready &&
            (user ? (
              <Button size="sm" variant="outline" onClick={signOut}>
                Sign out
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            ))}
        </nav>
      </div>
    </header>
  );
}
