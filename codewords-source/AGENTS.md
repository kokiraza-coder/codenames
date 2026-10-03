<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Game moves (create/join/seat/start/clue/guess/end turn) and stat updates run only in database security-definer functions; tables are read-only to clients — why: prevents cheating and keeps scoring consistent.
- The secret card key lives in a separate table readable only by spymasters or after the game ends — why: operatives must never receive card colours.
- Pre-bundle newly added client deps in vite optimizeDeps — why: mid-session re-optimization loads duplicate React and blanks the page.
