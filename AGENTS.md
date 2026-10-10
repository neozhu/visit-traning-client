# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains a native WeChat Mini Program TypeScript starter.

- `miniprogram/app.ts`, `app.json`, and `app.wxss` define application startup, page registration, and global styles.
- `miniprogram/pages/index/` and `pages/logs/` contain page bundles: matching `.ts`, `.wxml`, `.wxss`, and `.json` files.
- `miniprogram/utils/` holds shared helpers; `typings/` provides application and WeChat API declarations.
- `doc/` contains the VisitSafe workflow brief and a training-flow mockup. The full SPEC referenced by `doc/spec.md` is absent; clarify requirements before implementing that scope.

There is no dedicated test or runtime-assets directory yet.

## Build, Test, and Development Commands

- `npm install`: install the declared development dependency, `miniprogram-api-typings`.
- Import the repository root into WeChat Developer Tools. `project.config.json` selects `miniprogram/` and the TypeScript compiler plugin.
- Use **Compile** to build and run in the simulator; use **Preview** for device checks.

`package.json` defines no build, test, lint, or formatting scripts. Do not assume `npm test` or `npm run build` exists.

## Coding Style & Naming Conventions

Use two-space indentation, as configured in the editor settings. Follow existing TypeScript conventions: camelCase functions and variables, single-quoted strings, and omitted semicolons. Use descriptive kebab-case WXSS classes. Keep page filenames aligned with their directory and register new pages in `miniprogram/app.json`. Respect the strict checks in `tsconfig.json`; no formatter or linter is configured.

## Testing Guidelines

No automated test framework, test naming convention, or coverage threshold is configured. Compile affected pages and manually verify navigation, avatar/nickname interaction, and stored-log display. Test storage-dependent changes with empty and populated storage. For implemented VisitSafe flows, verify the scenarios in `doc/spec.md`. Report what was checked and any verification limits.

## Commit & Pull Request Guidelines

Git metadata is unavailable in this checkout, so historical commit conventions cannot be confirmed. Use short imperative subjects, such as `Add visitor registration page`. Keep changes focused. Pull requests should explain the behavior changed, link relevant issues, list manual checks, and include screenshots for UI changes.

## Configuration & Scope

`project.private.config.json` overrides shared configuration; keep machine-specific settings there. The VisitSafe brief calls for mock data and local storage. Backend, live API, or cloud integration requires a scope decision. Prefer simple solutions and avoid unrelated refactoring.
