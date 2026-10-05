# perezamadorluisenrique-gif.github.io

Landing page for Hidden Problems Lab's three free apps, and the Android Digital Asset Links file.

**Live:** https://perezamadorluisenrique-gif.github.io/

- [Same Pill, New Look](https://perezamadorluisenrique-gif.github.io/same-pill-new-look/) ([source](https://github.com/perezamadorluisenrique-gif/same-pill-new-look))
- [RecallRadar](https://perezamadorluisenrique-gif.github.io/recall-radar/) ([source](https://github.com/perezamadorluisenrique-gif/recall-radar))
- [47-Day Cert Radar](https://perezamadorluisenrique-gif.github.io/cert-radar/) ([source](https://github.com/perezamadorluisenrique-gif/cert-radar))

## Why this repo exists

The Android versions of the apps are Trusted Web Activities. Android only hides the browser bar when the site proves it owns the app, and it checks exactly one URL at the origin root:

```
https://perezamadorluisenrique-gif.github.io/.well-known/assetlinks.json
```

The app repos are project sites under subpaths and can't serve that path, so this user-site repo does. `.nojekyll` makes GitHub Pages serve the dotted `.well-known` folder.

`assetlinks.json` is an empty list until the Android upload keys exist. Each app then gets one statement with both SHA-256 fingerprints (the Play app signing key and the upload key):

```json
{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.github.perezamadorluisenrique.samepill",
    "sha256_cert_fingerprints": ["AA:BB:..."]
  }
}
```

Package ids: `io.github.perezamadorluisenrique.samepill`, `.recallradar`, `.certradar`. Verify with Google's tester: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://perezamadorluisenrique-gif.github.io&relation=delegate_permission/common.handle_all_urls

Don't add folders named after the app repos here: a project site at the same path takes precedence, so they would never be served.

## Commands

| Job | Command |
|---|---|
| Tests (asset links format, landing page links, safety wording) | `npm test` |
| Serve | `npm start` (:8080) |

Deploy: `.github/workflows/pages.yml` runs the tests on pull requests; on main it publishes to `gh-pages` and checks the live page and asset links URL.

## Privacy

No accounts, no cookies. Visits are counted with [GoatCounter](https://www.goatcounter.com/) (`stats.js`): only the page path, the referring site and the screen width, and nothing when Do Not Track is on.
