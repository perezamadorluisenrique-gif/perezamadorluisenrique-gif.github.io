# perezamadorluisenrique-gif.github.io

User site for Hidden Problems Lab: the landing page linking the three apps, and
`.well-known/assetlinks.json` for the Android TWAs (plan: `/mnt/project-files/apk-plan/apk-plan.md`).
Live: https://perezamadorluisenrique-gif.github.io/
Project policy lives in `/mnt/project-files/autopilot/charter.md`.

## Commands
| Job | Command |
|---|---|
| Tests | `npm test` |
| Serve | `npm start` (:8080) |

## Rules
- Same Pill never identifies a pill ("confirm with your pharmacist"); RecallRadar never calls a product safe; Cert Radar dates come from public CT logs.
- `assetlinks.json` lists only the three package ids in the test, each with both SHA-256 fingerprints (Play app signing key and upload key). A wrong file breaks every installed Android app's full-screen mode.
- Work on a branch and open a PR; gates must be green before merge. Never skip a test.

## Traps
- Never add a folder named after an app repo: the project site at that path wins.
- Keep `.nojekyll`, or Pages stops serving `.well-known`.
- The sandbox can't reach github.io; the workflow's `live` job is the probe, WebFetch the page.
