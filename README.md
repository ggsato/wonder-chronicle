# Wonder Chronicle

Wonder Chronicle is a vertical Japanese self-chronicle MVP. The current build focuses on proving that `Wish`, `Wonder at`, `Wonder about`, and photos can form a readable timeline before adding richer editorial features.

## Current MVP Scope

- Timeline screen with scroll-style layout
- Granularity switch: `day` / `week` / `month`
- Direction switch: `recent-right` / `past-right`
- Anchor jumps: `today` / `latest` / `earliest`
- Minimal entry form with local image upload
- Minimal detail panel for the selected period
- AI-powered `change-point timeline` as a timeline mode
- `1 day = 1 entry` update behavior

## Getting Started

```bash
npm install
export OPENAI_API_KEY=your_api_key_here
npm run dev
```

The dev server is configured for LAN access at `http://192.168.11.52:5173`.

If `OPENAI_API_KEY` is not set, the main timeline still works and the change-point timeline shows an unavailable state instead of breaking the UI. When the user switches to `change-point timeline`, the app opens a dialog where the user can choose `3 / 5 / 10` extraction count before generating. Generated change points act as retrospective links back into the corresponding `day` view.

Production build:

```bash
npm run build
```

## Docs

- Spec source of truth: [docs/specs/wonder-chronicle-mvp.md](docs/specs/wonder-chronicle-mvp.md)
- Implementation decision log: [docs/decisions/2026-04-12-mvp-implementation.md](docs/decisions/2026-04-12-mvp-implementation.md)
- AI change-point decision log: [docs/decisions/2026-04-13-ai-change-point-timeline.md](docs/decisions/2026-04-13-ai-change-point-timeline.md)

## Spec And Docs Workflow

Wonder Chronicle defines and confirms product behavior through GitHub Issues before implementation. For spec work, both ChatGPT and Codex review the Issue discussion, then the agreed result is reflected into `docs/` before code changes proceed.

### Source Of Truth

- Spec discussion happens in GitHub Issues.
- Confirmed spec content is reflected in `docs/specs/`.
- Implementation-specific decisions and spec deltas are recorded in `docs/decisions/`.

### Rules

- Implementation starts only after the relevant Issue has been reviewed and the required spec updates are reflected in `docs/`.
- If implementation reveals a spec change or clarification, update the Issue and `docs/` first, then continue coding.
- Unless explicitly excluded, a Codex implementation request includes the necessary `docs/` synchronization work.
- If Codex finds a mismatch between code and docs, it should not close the task with code changes alone; it should also update the relevant docs or call out the required docs change.

### Definition Of Done

- Code, Issue discussion, and `docs/` are synchronized for any behavior that affects the product spec.
- `README.md`, `docs/specs/`, and `docs/decisions/` do not contradict the implemented behavior.
