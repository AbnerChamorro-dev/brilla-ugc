# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Brilla** — a Spanish-language platform where UGC creators build shareable portfolios. Two pages: a marketing landing (`app/page.tsx`) and the portfolio builder (`app/crear/page.tsx`). Started from the `site-creator-vinext-starter` template (an OpenAI Sites project — see `.openai/hosting.json`).

## Commands

Requires Node >= 22.13.0. Uses npm (`package-lock.json`).

- `npm run dev` — local dev server
- `npm run build` — production build (output goes to `dist/`, not `.next/`)
- `npm test` — runs the build, then `node --test tests/rendered-html.test.mjs` (the only test; it imports the built worker from `dist/server/index.js` and asserts on the rendered HTML — a build must exist/succeed first)
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`; ignores `dist` and `.next`)
- `npm run db:generate` — Drizzle migration generation (currently moot; see Database below)

## Architecture

### Not standard Next.js hosting

This uses **vinext**: Next.js App Router code compiled by Vite and served by a **Cloudflare Worker**, not `next dev`/`next build`. Consequences:

- `worker/index.ts` is the runtime entry — it handles `/_vinext/image` image optimization, then delegates everything else to `vinext/server/app-router-entry`. `next.config.ts` is essentially empty.
- Bindings (D1, R2) are declared in `.openai/hosting.json` (both currently `null`) and simulated locally by `vite.config.ts` via `@cloudflare/vite-plugin`. There is deliberately **no `wrangler.jsonc`** — don't add one.
- Server code runs in the Workers runtime (`nodejs_compat`), not Node.

### The builder (`app/crear/page.tsx`)

The entire product lives in this one client component (~165 dense lines):

- A 6-step wizard (Identidad → Dirección → Portafolio → Audiencia → Tarifas → Contacto) editing a single `Portfolio` state object, with a live preview alongside and a full-screen final view.
- Two output formats chosen in step 2: `WebsitePortfolio` (vertical scrolling site, 4 templates: pop/retro/chic/bold) and `PortfolioDeck` (horizontal slide deck with wheel/drag/keyboard navigation, 7 templates: gallery/studio/scrapbook/art/blue/whimsy/sage). Templates are pure CSS: the wrapper gets `website-{mode}` or `deck-{mode}` plus `font-{style}`, and the accent color flows through the `--site-accent` / `--deck-accent` CSS custom properties.
- Drafts auto-save (debounced 450ms) to `localStorage` under `brilla-portfolio-draft-v2`. Uploaded media/brand logos are `URL.createObjectURL` blobs — client-only, never persisted; there is no backend yet.

### CSS layout

- `app/globals.css` — landing page
- `app/crear/crear.css` — builder chrome (sidebar, form fields, topbar)
- `app/crear/templates.css` — presentation deck (`deckSlide`, `deck-*` themes)
- `app/crear/website.css` — website format (`websitePortfolio`, `website-*` themes)
- `app/crear/showreel.css` and `app/crear/world.css` are **unimported leftovers** from earlier design iterations (see git history) — don't extend them; delete or ignore.

### Code style

Both pages and all CSS are written extremely densely — one-line JSX components, multi-declaration lines, minified-style CSS. Match this style when editing; don't reformat existing code.

### Auth (available, unused)

`app/chatgpt-auth.ts` provides Sign-in-with-ChatGPT helpers (`getChatGPTUser`, `requireChatGPTUser`, sign-in/out path builders) backed by `oai-authenticated-user-*` headers injected by the Sites platform. Reserved routes (`/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`) are owned by the platform — never implement them. Pages calling these helpers need `export const dynamic = "force-dynamic"`. Full details in `README.md`.

### Database (wired, empty)

Drizzle + Cloudflare D1 scaffolding exists (`db/index.ts` exposes `getDb()`, `db/schema.ts` is intentionally empty, `drizzle.config.ts` targets sqlite). To actually use it: add tables to `db/schema.ts`, set `d1: "DB"` in `.openai/hosting.json`, and run `npm run db:generate`. `examples/d1/` has a reference implementation.
