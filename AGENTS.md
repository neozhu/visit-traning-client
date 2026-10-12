# Repository Guidelines

## Project Structure & Module Organization

This repository contains a standalone React mobile web application for visitor registration and safety training.

- `web/` contains the standalone React + TypeScript + Vite application. Use Ant Design Mobile for standard mobile interactions and Tailwind CSS for page layout.
- `web/src/pages/` contains routed screens; `web/src/components/` contains shared UI; `web/src/domain/` contains business types, mock configuration, validation and local persistence.
- `web/public/assets/` contains product artwork, icons and demonstration videos. Retain asset license files.
- `web/src/**/*.test.ts` contains business tests; `web/e2e/` contains Playwright mobile browser tests.
- The repository root provides command wrappers for `web/`; do not add a second application or duplicate its dependencies at the root.
- `doc/VisitSafe-React-Mobile-SPEC.md` defines the React delivery scope; `doc/VisitSafe-React-Mobile-PLAN.md` tracks its implementation. Frontend and backend SPECs remain the product references.

## Build, Test, and Development Commands

- Install the React application's dependencies with `npm --prefix web install`. The root package only provides command wrappers and has no application dependencies.
- React commands can be run directly with `npm --prefix web run dev`, `npm --prefix web run build`, `npm --prefix web run typecheck`, `npm --prefix web test` and `npm --prefix web run test:e2e`.
- Root scripts expose the React development and build commands; check `package.json` for the exact script names.
- `npm test` runs the React business tests; `npm run test:e2e` runs the mobile browser flows.
- Headless browser checks do not replace real phone verification.

## Coding Style & Naming Conventions

Use two-space indentation, camelCase functions and variables, single-quoted strings, and omitted semicolons. Use PascalCase React components and descriptive kebab-case CSS classes. Keep domain code independent of React and browser UI. Respect strict TypeScript checks.

Target modern phone browsers only; no desktop layout or legacy browser support is required. Preserve the existing blue brand, Chinese labels and task flows. Standard components use Ant Design Mobile's public APIs and CSS variables; avoid global overrides of internal `.adm-*` selectors. Keep custom controls accessible, touch friendly and clear in loading, error and empty states. Detailed React conventions live in `web/AGENTS.md`.

## Testing Guidelines

Run the narrowest meaningful verification while developing, then the React business tests, TypeScript check and production build before delivery. Use Playwright for the registration, individual training, exam and record flows at phone sizes; check at least 320px, 390px and 430px widths.

Test empty and populated storage, save failures, draft restoration, duplicate submission, independent person progress, exact name-and-phone queries, exam expiry after reload, retakes, and deletion of related tasks. UI changes need screenshots or browser inspection. Clearly distinguish automated mobile viewport checks from real phone checks and report any verification limits.

## Commit & Pull Request Guidelines

Develop the React rebuild on `feat/visitsafe-react-mobile` or another explicitly requested feature branch. Use short imperative commit subjects and keep changes focused. Pull requests should explain behavior, list verified checks and include screenshots for UI changes. Do not merge, push or publish without authorization.

## Configuration & Scope

The current React scope uses mock data and a separate browser local-storage namespace. It does not include real authentication, shared cross-device data, backend approval or actual gate authorization. Backend SPEC rules remain requirements for later API integration; do not present them as implemented services.

Use current stable package versions and lock dependencies. Backend, live API, cloud integration and hosting require a scope decision. Keep secrets and machine-specific files out of Git. Historical business documents may describe the earlier client; current frontend implementation and verification follow the React SPEC. Prefer simple, direct solutions and avoid unrelated refactoring.
