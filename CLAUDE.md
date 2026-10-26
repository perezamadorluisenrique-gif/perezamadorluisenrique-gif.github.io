# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`perezamadorluisenrique-gif.github.io`: user site for Hidden Problems Lab: the landing page linking the three apps, and
`.well-known/assetlinks.json` for the Android TWAs (plan: `/mnt/project-files/apk-plan/apk-plan.md`).
Live: https://perezamadorluisenrique-gif.github.io/
Also hosts `plugin-inspector/`, the public Obsidian Plugin Inspector (any community plugin's
downloads, rank, version chart, similar plugins, release health check; `?q=<id-or-owner/repo>` deep links):
https://perezamadorluisenrique-gif.github.io/plugin-inspector/
Project policy lives in `/mnt/project-files/autopilot/charter.md`.

## Commands
| Job | Command |
|---|---|
| Tests | `npm test` |
| One test | `node --test --test-name-pattern '<name>' test/*.test.js` |
| Serve | `npm start` (:8080) |

No build step or dependencies: plain HTML and JS, deployed as-is. `plugin-inspector/inspect.js` is a UMD module (browser global and `module.exports` for the Node tests); `stats.js` is the GoatCounter counter, live host only, never the query string (tested).

## Rules
- Same Pill never identifies a pill ("confirm with your pharmacist"); RecallRadar never calls a product safe; Cert Radar dates come from public CT logs.
- `assetlinks.json` lists only the three package ids in the test, each with both SHA-256 fingerprints (Play app signing key and upload key). A wrong file breaks every installed Android app's full-screen mode.
- Work on a branch and open a PR; gates must be green before merge. Never skip a test.
- Plugin Inspector: logic only in `plugin-inspector/inspect.js` (tested under Node in `test/plugin-inspector.test.js`), the page only fetches and renders; external text goes in with `textContent`, never `innerHTML`. Keep its checks in step with `obsidian-dev/tools/doctor` and `tools/release/review-lint.mjs`.

## Traps
- Never add a folder named after an app repo: the project site at that path wins.
- Keep `.nojekyll`, or Pages stops serving `.well-known`.
- A new top-level folder must also go in the deploy job's `cp` line in `.github/workflows/pages.yml`, or it is never published.
- The sandbox can't reach github.io; the workflow's `live` job is the probe, WebFetch the page.
