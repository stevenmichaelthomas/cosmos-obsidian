# Contributing

Bug reports, questions, and pull requests are welcome.

## Reporting a bug

Open an issue at [github.com/stevenmichaelthomas/cosmos-obsidian/issues](https://github.com/stevenmichaelthomas/cosmos-obsidian/issues) and include:

- Your Obsidian version and platform (desktop or mobile)
- The plugin version, from Settings → Community Plugins
- What you did, what happened, and what you expected instead
- Any errors from the developer console (`Ctrl`/`Cmd` + `Shift` + `I`)

Please do not paste vault contents into an issue. The plugin never transmits them, and a bug report does not need them.

## Development setup

Requires Node 20 or later.

```bash
git clone https://github.com/stevenmichaelthomas/cosmos-obsidian
cd cosmos-obsidian
npm install
npm run dev     # rebuilds main.js on change
```

To test against a real vault, symlink or copy the repo into `.obsidian/plugins/cosmos-sync/` and reload Obsidian (`Cmd`/`Ctrl` + `R`) after each build.

Before opening a pull request:

```bash
npx tsc --noEmit    # must pass with no errors
npm run build       # must produce main.js
```

## Layout

| Path | Purpose |
|------|---------|
| `src/main.ts` | Plugin entry point, commands, ribbon icon |
| `src/settings.ts` | Settings tab and delete-system modal |
| `src/sync.ts` | Vault walk, parsing, and the sync routine |
| `src/db.ts` | Minimal PostgREST client over Obsidian's `requestUrl` |
| `src/engine/` | Hashing, orbital parameter generation, palette |

## Constraints

Two properties define this plugin. Changes that weaken either will not be merged.

**No vault content leaves the device.** File contents, file names, folder structure, and tags are inputs to a local one-way transform and nothing else. Only derived numbers — orbital radius, eccentricity, size, mass, color index — are sent. If a change would put anything else on the wire, it needs a different design.

**The release build stays auditable.** `main.js` is built from `src/` by CI and carries a GitHub artifact attestation. Keep the dependency tree small and avoid libraries that ship pre-transpiled ES5 bundles, obfuscated code, or transitive dependencies the plugin does not use — they make the published build harder to verify and surface as warnings on the community plugin scorecard. Network calls go through Obsidian's `requestUrl` rather than `fetch`, so they work on mobile.

## Releasing

Maintainers only. See the release steps in the repository's `CLAUDE.md`: bump `manifest.json` and `versions.json`, add a `CHANGELOG.md` entry, build, then push a tag matching the version. CI builds, attests, and publishes the release from that tag.
