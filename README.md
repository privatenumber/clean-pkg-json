# clean-pkg-json

Only publish necessary `package.json` properties.

`clean-pkg-json` removes development-only properties, such as `devDependencies`, most `scripts`, and tool configs, from `package.json` right before you pack or publish.

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## Install

```sh
npm install -D clean-pkg-json
```

## Setup

Run it in the [`prepack`](https://docs.npmjs.com/cli/using-npm/scripts#life-cycle-scripts) script, after your build:

```json5
// package.json
{
    "scripts": {
        "prepack": "npm run build && clean-pkg-json",
    },
}
```

`prepack` runs on `npm pack` and `npm publish` (and the pnpm and Yarn equivalents), so the cleaned `package.json` is what gets published.

### Good to know

- **Build before cleaning.** Run `clean-pkg-json` after the build, in the same `prepack` script.
- **`package.json` stays cleaned.** After a local `npm pack`, restore it with `git checkout package.json`.
- **Don't run it as a separate step before other tools.** Use `prepack`. If you must, keep what those tools need, for example `clean-pkg-json --keep packageManager`.
- **Don't restore `package.json` in `postpack`.** It publishes the uncleaned metadata.
- **Preview the cleaned `package.json` with `clean-pkg-json --dry`.** It prints the result and doesn't write the file.
- **Don't trust the numbers from `npm pack --dry-run`.** `clean-pkg-json` doesn't change `package.json` during an npm dry run, so npm's file sizes, shasum, and integrity describe the original file. `clean-pkg-json` prints a note when this happens. For the real values, pack without `--dry-run`, then run `git checkout package.json`.
- **With pnpm 11+ and Yarn 4, dry runs clean `package.json` too.** Restore it afterward with `git checkout package.json`.

<details>
<summary>Why</summary>

- **Build before cleaning:** `exports` and `imports` entries are removed when their files aren't in the package. Files that aren't built yet look missing, so their entries get removed. A warning is printed when this happens.
- **`package.json` stays cleaned:** `clean-pkg-json` rewrites `package.json` in place and doesn't keep a copy.
- **Separate steps:** every command after the cleanup sees the cleaned file. For example, without `packageManager`, Corepack falls back to its default version, so `clean-pkg-json && changeset publish` in a Yarn 4 project runs changesets with Yarn 1. In `prepack`, the publish tool has already started before the cleanup runs.
- **`postpack`:** npm reads `package.json` again after `postpack` to build the registry metadata. A restore there sends the original file, including all scripts, to the registry while the tarball has the cleaned one.
- **npm dry runs:** `npm pack --dry-run` and `npm publish --dry-run` still run `prepack` and build the tarball in memory. `clean-pkg-json` detects the dry run (`npm_config_dry_run`, which pnpm 10 also sets), prints the cleaned result, and leaves `package.json` unchanged, so npm packs the original file. npm packs only the `package.json` on disk, so a dry run can't pack the cleaned file without changing it. Restoring the file afterward would need a separate `postpack` step, which doesn't run if the pack fails or is interrupted.
- **pnpm 11+ and Yarn 4:** they don't tell lifecycle scripts about a dry run, so `clean-pkg-json` can't detect it and writes the file as in a real pack.

</details>

## Example

Given this `package.json`:

```json
{
    "name": "my-package",
    "version": "1.0.0",
    "description": "A useful package",
    "type": "module",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "files": [
        "dist"
    ],
    "scripts": {
        "build": "pkgroll",
        "lint": "eslint .",
        "test": "vitest",
        "prepack": "npm run build && clean-pkg-json"
    },
    "dependencies": {
        "lodash": "^4.0.0"
    },
    "devDependencies": {
        "pkgroll": "^2.0.0",
        "vitest": "^1.0.0",
        "clean-pkg-json": "^2.0.0"
    },
    "eslintConfig": {
        "extends": [
            "@pvtnbr"
        ]
    },
    "lint-staged": {
        "*.ts": "eslint --fix"
    },
    "simple-git-hooks": {
        "pre-commit": "npx lint-staged"
    }
}
```

The published `package.json` is:

```json
{
    "name": "my-package",
    "version": "1.0.0",
    "description": "A useful package",
    "type": "module",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "files": [
        "dist"
    ],
    "dependencies": {
        "lodash": "^4.0.0"
    }
}
```

## Flags

| Flag | Description |
| - | - |
| `-k, --keep <property name>` | Keep more properties, e.g. `-k eslintConfig` or `-k scripts.prepare`. Accepts multiple flags or a comma-separated list. |
| `-r, --remove <property name>` | Remove properties that are kept by default, e.g. `-r scripts.postinstall`. Accepts multiple flags or a comma-separated list. |
| `-d, --dry` | Print the cleaned `package.json` without writing it. |
| `-v, --verbose` | Log what is kept and removed. |
| `--published-only=false` | Don't prune `exports` and `imports`. |
| `-h, --help` | Show help. |
| `--version` | Show version. |

## How it works

- **Properties:** only [properties that consumers use](#default-preserved-properties) are kept. Everything else is removed.
- **Scripts:** only install hooks (`preinstall`, `install`, `postinstall`) are kept, because they run when someone installs your package. If no scripts are left, `scripts` is removed.
- **`exports` and `imports`:** entries that point to files outside the published package are removed, so consumers can't resolve to files that don't exist. In conditional entries, only the unpublished branches are removed.

## Default preserved properties

<details>
<summary>View full list</summary>

### [npm](https://docs.npmjs.com/cli/v8/configuring-npm/package-json)
- `name`
- `version`
- `private`
- `publishConfig`
- `scripts.preinstall`
- `scripts.install`
- `scripts.postinstall`
- `gypfile`
- `binary` ([prebuild-install](https://github.com/prebuild/prebuild-install), [node-pre-gyp](https://github.com/mapbox/node-pre-gyp))
- `files`
- `bin`
- `browser`
- `main`
- `directories`
- `man`
- `dependencies`
- `peerDependencies`
- `peerDependenciesMeta`
- `bundleDependencies`
- `bundledDependencies`
- `optionalDependencies`
- `engines`
- `os`
- `cpu`
- `libc`
- `description`
- `keywords`
- `author`
- `maintainers`
- `contributors`
- `license`
- `homepage`
- `repository`
- `bugs`
- `funding`

### CDNs
- [`jsdelivr`](https://www.jsdelivr.com/documentation#id-configuring-a-default-file-in-packagejson)
- [`unpkg`](https://unpkg.com/)

### [Node.js](https://nodejs.org/api/packages.html#nodejs-packagejson-field-definitions)
- `type`
- `exports`
- `imports`

### [VSCode Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- `sponsor`
- `publisher`
- `displayName`
- `categories`
- `galleryBanner`
- `preview`
- `contributes`
- `activationEvents`
- `badges`
- `markdown`
- `qna`
- `extensionPack`
- `extensionDependencies`
- `extensionKind`
- `icon`

### [Angular Package Format](https://angular.dev/tools/libraries/angular-package-format)
- `fesm2020`
- `fesm2015`
- `esm2020`
- `es2020`

### [TypeScript](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- `types`
- `typings`
- `typesVersions`
- `typescript` ([content mapper](https://github.com/microsoft/typescript-go/pull/4712) manifest, TypeScript 7.1+)

### Bundlers (Webpack, Rollup, esbuild)
- [`module`](https://stackoverflow.com/questions/42708484/what-is-the-module-package-json-field-for)
- [`sideEffects`](https://webpack.js.org/guides/tree-shaking/)

</details>

## Agent Skills

This package ships with [agent skills](https://agentskills.io) for AI coding assistants.
