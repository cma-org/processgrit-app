# ProcessGrit · PCBA Quality Intelligence Platform

Standalone, deployable build of the ProcessGrit v2 demo (exported from Claude Design).
No build step, no npm dependencies. A ~100-line Node server hosts the static app.

## Run locally

```bash
npm start          # http://localhost:3000
npm run dev        # same, restarts on server.js changes
npm run test:smoke # verifies every asset is served
```

Requires Node 18+. In VS Code you can also press F5 ("Run ProcessGrit").

## Deploy to Railway (terminal)

```bash
npm i -g @railway/cli
railway login
railway init        # create a new project (first time only)
railway up          # build from Dockerfile and deploy
railway domain      # generate a public *.up.railway.app URL
```

Railway injects `PORT`; the server reads it. Health check: `GET /healthz`.
To redeploy after edits, run `railway up` again, or connect the GitHub repo in
the Railway dashboard for deploy-on-push.

## How it is built

| Path | What it is |
|---|---|
| `server.js` | Zero-dependency static server: gzip, caching, `/` → app shell redirect, `/healthz` |
| `public/ProcessGrit.dc.html` | App shell: sidebar, scenarios, personas, ⌘K palette, walkthrough, toasts, drawer |
| `public/PGv2*.dc.html` | The 11 screens, each a DC component (template + `class Component extends DCLogic`) |
| `public/pg-engine-v2.js` | All business logic and synthetic data as a `window.PG` store, persisted to `localStorage` |
| `public/support.js` | Claude Design `dc-runtime`: compiles `.dc.html` templates into React 18 elements |
| `public/resources.js` | Points the runtime at `/vendor` instead of unpkg |
| `public/vendor/` | React 18.3.1, ReactDOM 18.3.1, Babel standalone 7.29.0 (byte-identical to the CDN builds; SRI hashes match) |
| `public/_ds/` | Design-system stylesheets referenced by the screens |
| `docs/BRD.txt` | Source requirements text |

The only external request at runtime is Google Fonts (Geist). Without it the UI
falls back to the system font.

## Editing

- Screen UI: edit the HTML template inside `<x-dc>` in the matching `PGv2*.dc.html`.
  Bindings use `{{ expr }}`, conditionals `<sc-if>`, loops `<sc-for>`, composition `<dc-import name="...">`.
- Screen behaviour: edit `renderVals()` in that file's `<script data-dc-script>` block.
- Data, rules, gates, KPIs: edit `pg-engine-v2.js`. After changing seed data, use
  "Reset scenarios" in the app (state is cached in localStorage under `pg-app-v2b`).
- Do not edit `support.js`; it is a generated runtime.

## Notes

- Three console messages like `<path> attribute d: Expected moveto ... "{{ n.d }}"` appear on
  load. The browser briefly parses the raw template before the runtime replaces it; they are harmless.
- Each visitor's demo state lives in their own browser (localStorage). There is no backend or shared data.
