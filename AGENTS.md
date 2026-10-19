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

- This is a plain Vite + React SPA (no SSR). Routes are declared in src/router.tsx with React Router; page components live in src/routes/.
- Signed-in pages are wrapped in `RequireAuth` (src/routes/require-auth.tsx), a client-only gate redirecting to /sign-in, since the session lives in browser storage.
- `vite build` outputs a static site to dist/; vercel.json rewrites every path to index.html so deep links like /app resolve client-side.
