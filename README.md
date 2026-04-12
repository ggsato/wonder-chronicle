# Wonder Chronicle

Wonder Chronicle is a vertical Japanese self-chronicle MVP. The current build focuses on proving that `Wish`, `Wonder at`, `Wonder about`, and photos can form a readable timeline before adding richer editorial features.

## Current MVP Scope

- Timeline screen with scroll-style layout
- Granularity switch: `day` / `week` / `month`
- Direction switch: `recent-right` / `past-right`
- Anchor jumps: `today` / `latest` / `earliest`
- Minimal entry form with local image upload
- Minimal detail panel for the selected period
- `1 day = 1 entry` update behavior

## Getting Started

```bash
npm install
npm run dev
```

The dev server is configured for LAN access at `http://192.168.11.52:5173`.

Production build:

```bash
npm run build
```

## Docs

- Spec source of truth: [docs/specs/wonder-chronicle-mvp.md](docs/specs/wonder-chronicle-mvp.md)
- Implementation decision log: [docs/decisions/2026-04-12-mvp-implementation.md](docs/decisions/2026-04-12-mvp-implementation.md)
