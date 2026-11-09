# perezamadorluisenrique-gif.github.io

User site for Hidden Problems Lab: the landing page linking the three apps, and
`.well-known/assetlinks.json` for the Android TWAs.
Live: https://perezamadorluisenrique-gif.github.io/
Also hosts `plugin-inspector/`, the public Obsidian Plugin Inspector (any community plugin's
downloads, rank, version chart, similar plugins, release health check; `?q=<id-or-owner/repo>` deep links):
https://perezamadorluisenrique-gif.github.io/plugin-inspector/
General rules: the owner's Claude project instructions. This file adds only what is specific to this repo.

## Commands
| Job | Command |
|---|---|
| Tests | `npm test` |
| Serve | `npm start` (:8080) |
| Catalog (one page per free product, sitemap, robots; reads each repo's README and manifest) | `node catalog/build.mjs --out /tmp/site [--local <dir with the clones>]` |
| Inspector CLI (same checks, on a local folder or owner/repo; exit 1 on fail) | `node plugin-inspector/cli.js <folder\|owner/repo> [--json] [--offline]` |

## Rules
- Public repo: never add a `Claude-Session:` trailer or any claude.ai link to commits, PR titles or PR bodies. This rule beats the default attribution guidance.
- Same Pill never identifies a pill ("confirm with your pharmacist"); RecallRadar never calls a product safe; Cert Radar dates come from public CT logs.
- `assetlinks.json` lists only the three package ids in the test, each with both SHA-256 fingerprints (Play app signing key and upload key). A wrong file breaks every installed Android app's full-screen mode.
- Plugin Inspector: logic only in `plugin-inspector/inspect.js` (tested under Node in `test/plugin-inspector.test.js`), the page only fetches and renders; external text goes in with `textContent`, never `innerHTML`. Keep its checks in step with `obsidian-dev/tools/doctor` and `tools/release/review-lint.mjs`.

## Catalog
- `/catalog/` is generated, never committed: `catalog/products.json` lists the products, `catalog/build.mjs` writes pages, `sitemap.xml` and `robots.txt` into `_site` on every deploy and daily (`schedule` in `pages.yml`), so a release shows up within a day. A new product is one line in `products.json`; `optional: true` skips it until it exists (the three pending WordPress plugins).
- Video: `catalog/video/<slug>.mp4` (real Obsidian captures, committed) wins; else a README GIF becomes MP4; else the README's first image. Pro and prices never appear there.
- The build validates every page (title, description, one h1, OG, alt, JSON-LD, canonical in the sitemap) and exits 1 on a problem.

## Traps
- Never add a folder named after an app repo: the project site at that path wins.
- Keep `.nojekyll`, or Pages stops serving `.well-known`.
- A new top-level folder must also go in the deploy job's `cp` line in `.github/workflows/pages.yml`, or it is never published.
- The sandbox can't reach github.io; the workflow's `live` job is the probe, WebFetch the page.
