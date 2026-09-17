# House Sixty CRM — web panel

The CRM panel. A **standalone** Next.js application with its own repository and its own
deployment, separate from the marketing site at `housesixty.com`.

> This is a change from CRM.md §1, which specified a `(crm)` route group inside the
> existing website repo. The decision was reversed on 2026-09-08: the panel is a
> separate site with a separate deploy. Nothing is shared with the marketing site — not
> the build, not the styles, not a component.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · plain CSS modules.

Next 16 rather than the marketing site's 14. Every 14.x release carries open
high-severity advisories, several of which matter for an auth-gated tool — middleware
bypass, cache poisoning on middleware redirects, and unauthenticated disclosure of
internal Server Function endpoints. `npm audit` on this project reports zero.

No CSS framework and no component library. The design is 18 finished mockups with a
small, fixed token set; a utility framework would add a build step and a dependency to
express the same thing.

## Running it

```bash
cp .env.example .env.local     # point CRM_API_BASE_URL at a backend
npm install
npm run dev
```

| Variable | |
|---|---|
| `CRM_API_BASE_URL` | Backend origin — scheme and host only, no trailing slash, no `/api`. `src/lib/api.ts` appends the paths. |

No `NEXT_PUBLIC_` variables, and none should be added. Everything the panel knows about
the backend stays on the server.

`.env.local` in this checkout points at `http://localhost:8080`. The production backend,
website and both app pairs are live with real members — do not repoint it without
asking first.

## How auth works

- The JWT pair lives in **httpOnly cookies**, never in `localStorage` and never in the
  client bundle. Every backend call goes through `src/lib/api.ts`, server-side.
- **Role comes from the user object in `AuthResponse`, never from decoding a token.**
  The refresh token carries no `role` claim, so anything reading the role off a token
  works for exactly fifteen minutes and then silently reads empty.
- **401 → refresh once and replay. 403 → show a permission message and stay signed in.**
  A 403 is "wrong role", and logging someone out for it turns a permissions message
  into an apparently broken panel. `apiRequest` returns a discriminated union rather
  than throwing, specifically so these two cannot collapse into one path.
- `src/middleware.ts` is a *cheap* guard — it only checks that session cookies exist, to
  keep anonymous visitors off the shell. The real boundary is the backend, which
  role-gates every `/api/v1/crm/**` endpoint.

## Deployment

**Live at `https://crm.housesixty.com`** since 2026-09-17 — Amplify app `d6b0szz1v0cm1`,
branch `main`, behind Amplify **basic auth**. The build spec is `amplify.yml` in this
repo (not console-side, unlike the marketing site). Pushing to `main` deploys.

The panel is **installable as a desktop app**: manifest plus icons, no service worker.
⚠️ The manifest is a static `public/manifest.webmanifest` with a hand-written
`<link rel="manifest" … crossOrigin="use-credentials">` in `layout.tsx`, and it has to
stay that way. A browser fetches a manifest with credentials omitted unless told
otherwise, so behind basic auth it 401s and Chrome silently offers no Install. Next's
Metadata API cannot set that attribute, so **do not reintroduce `app/manifest.ts`** — it
injects a second, credential-less link and restores the bug.

Amplify, as its own app, pointed at this repository.

**It must be deployed as compute (SSR), not as a static export.** A static deployment
does not run middleware — it does not error, it silently skips it — and the route guard
would simply not exist. That mistake has already cost this project hours on the
marketing site, where at least the symptom was an obviously blank page. Here it would
look like it worked.

Inject environment variables through `amplify.yml` before the build, as the marketing
site does; console-set variables do not reliably reach the SSR Lambda:

```yaml
    build:
      commands:
        - env | grep -e CRM_API_BASE_URL >> .env.production
        - npm run build
```

**Quotes around a value in the Amplify env panel silently break the key.** Paste bare.

## Structure

```
src/
  app/
    layout.tsx          root, lang="tr"
    globals.css         reset + base
    tokens.css          the entire palette — nothing else hardcodes a colour
    page.tsx            placeholder landing (becomes the dashboard shell)
    login/              page, form, server actions
  lib/
    api.ts              server-side backend client, refresh + replay
    session.ts          httpOnly cookie session
    roles.ts            panel roles, Turkish labels, presentation gating only
  middleware.ts         route guard
```

UI language is Turkish. Code, identifiers, comments and commits are English.
