# Order Management System Notes

## Current operating model

- Production URL: `https://takumitsuikebuchi-lab.github.io/order-management-system/`
- Default branch: `main`
- Runtime is a static site served from GitHub Pages.
- Shared cloud connection settings are stored in `cloud-config.json`.
- Browsers still keep `localStorage`, but day-to-day operation is designed to converge to the shared Supabase data.

## Important invariants

- `cloud-config.json` is the source of truth for Supabase URL / anon key / enabled flag.
- In normal operation, the in-app cloud settings modal is locked when shared config is active.
- Temporary manual override is only for maintenance and requires `?manualCloudConfig=1`.
- Order data, customer master, and simple masters are expected to sync through Supabase across PCs and browsers.
- Empty master arrays are valid data and must propagate to other devices.
- Order editing includes lightweight conflict detection. If the same order was changed elsewhere, the save should warn and stop.

## Normal operations

- New PCs and browsers should just open the production URL.
- Confirm the top-right status becomes `接続: Cloud（同期完了）`.
- Do not reconfigure cloud settings from the UI during normal business use.

## Emergency maintenance

### If Supabase URL or anon key must be changed

1. Edit `cloud-config.json`
2. Commit and push to `main`
3. Wait for GitHub Pages to update
4. Hard reload browsers (`Ctrl+F5` on Windows, `Cmd+Shift+R` on Mac)

### If you must bypass the lock temporarily

- Open `index.html?manualCloudConfig=1`
- Change the cloud settings in the modal
- Use this only for diagnosis or temporary recovery
- Afterward, reflect the final correct values back into `cloud-config.json`

### If devices show different data

1. Check the top-right status label
2. If it is not `接続: Cloud（同期完了）`, investigate connectivity and shared config first
3. Hard reload the page
4. Confirm `cloud-config.json` still points at the intended Supabase project
5. If only one browser is wrong, inspect whether that session was manually overridden

## Files AI tools should read first

- `README.md`
- `SETUP.md`
- `cloud-config.json`
- `index.html`

## Known design decisions

- The app is intentionally single-file centered: most behavior lives in `index.html`.
- Supabase writes are guarded by retry / queue logic.
- Shared config was added to eliminate browser-by-browser drift.
- Cloud settings UI was intentionally restricted to reduce accidental local-only operation.
