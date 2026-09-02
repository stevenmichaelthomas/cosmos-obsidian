# Changelog

## 0.4.6

Removes the bundled Supabase client in favour of a minimal PostgREST client, and fixes a sync hang on large vaults.

- **Fixed a sync hang on vaults with 1000 or more synced entries.** Existing entries were paged with the `Range` header, but PostgREST does not honour `Range` on this RPC endpoint — every request returned the full set, so the loop's `page.length < PAGE_SIZE` exit condition was never true and sync looped indefinitely against the API. Paging now uses the `limit`/`offset` query parameters with a stable sort, so pages neither overlap nor skip rows.
- **Removed the `@supabase/supabase-js` dependency.** The plugin used five RPC calls and two reads out of a 694KB library. Those now talk to PostgREST directly. The release build drops from 694KB to 31KB.
- **Resolves the `ws` vulnerability warning.** `ws` reached the plugin only as a transitive dependency of `@supabase/supabase-js` → `@supabase/realtime-js`. The plugin has no runtime dependencies now, so the advisory no longer applies.
- **No storage APIs in the build.** Supabase's auth layer referenced `localStorage`/`sessionStorage` even with session persistence disabled. Those references are gone. Settings continue to use Obsidian's `loadData`/`saveData`.
- **Network calls now use Obsidian's `requestUrl`** instead of `fetch`, avoiding CORS preflight on mobile.
- Existing-entry reads request only the columns the plugin uses, rather than every column.
- Added a contributing guide and this changelog.

## 0.4.5

- Added the community plugin install link to the README.

## 0.4.4

- Disabled Supabase session persistence to avoid `localStorage` use.
- Pinned the realtime transport to the native `WebSocket` so the `ws` package is never instantiated.
- Added GitHub artifact attestation to the release workflow.

## 0.4.3

- Version bump for an Obsidian community plugin submission re-check.

## 0.4.2

- Parallel sync for large vaults (40k+ files).
- Paginated entry fetching and a higher entry fetch limit.
- Wider orbital spread for large systems.
- Fixed errors and warnings raised during community plugin submission, including sentence case and an `async void` handler.

## 0.4.1

- Obsidian plugin guidelines compliance.

## 0.4.0

- Ownership verification on all write RPCs.
- System slug locked after first sync, so renaming a system no longer creates a duplicate.
- Owner-verified delete command.
- Star names default to `Sol N`, auto-incrementing from the existing count.

## 0.3.1

- Delete button in settings; all local state cleared on delete.

## 0.3.0

- Galaxy link shown after sync.
- Modifier key fix.
