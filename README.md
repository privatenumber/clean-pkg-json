# clean-pkg-json

Only publish necessary `package.json` properties.

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## Example

Given a `package.json` with dev configs, scripts, and devDependencies:

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
        "prepack": "clean-pkg-json"
    },
    "dependencies": {
        "lodash": "^4.0.0"
    },
    "devDependencies": {
        "pkgroll": "^2.0.0",
        "vitest": "^1.0.0",
        "clean-pkg-json": "^1.0.0"
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

Running `clean-pkg-json` produces:

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

## How it works

Uses an allowlist to preserve only [properties relevant to package consumers](#default-preserved-properties), everything else is removed.

For `scripts`, only install hooks (`preinstall`, `install`, `postinstall`, `dependencies`) are preserved. All other scripts are removed.

For `exports` and `imports`, entries referencing files not included in the published package are pruned. This prevents consumers from resolving to non-existent source files. Conditional entries are partially pruned — only unpublished branches are removed. Pass `--published-only=false` to disable this behavior.

If an entry is removed because its target file doesn't exist on disk, a warning is printed. This usually means `clean-pkg-json` ran before the build.

## Install

```sh
npm install -D clean-pkg-json
```

## Setup

Add `clean-pkg-json` to the [`prepack`](https://docs.npmjs.com/cli/v8/using-npm/scripts#:~:text=on%20npm%20publish.-,prepack,-Runs%20BEFORE%20a) script, which runs before `npm publish` and `npm pack`:

```json5
// package.json
{
    "scripts": {
        "prepack": "clean-pkg-json",
    },
}
```

When invoked via `npm pack --dry-run` or `npm publish --dry-run`, `clean-pkg-json` auto-detects npm's dry-run mode (via the `npm_config_dry_run` env var) and skips writing to disk.

### Flags

| Flag | Description |
| - | - |
| `-k, --keep <property name>` | Property names to keep. Accepts multiple flags or a comma-delimited list. |
| `-r, --remove <property name>` | Property names to remove. Accepts multiple flags or a comma-delimited list. |
| `-v, --verbose` | Verbose logs. |
| `-d, --dry` | Dry run — prints the result instead of writing to disk. |
| `--published-only=false` | Disable pruning of unpublished paths in `exports` and `imports`. |
| `-h, --help` | Show help |
| `--version` | Show version |

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
- `scripts.dependencies`
- `files`
- `bin`
- `browser`
- `main`
- `man`
- `dependencies`
- `peerDependencies`
- `peerDependenciesMeta`
- `bundledDependencies`
- `optionalDependencies`
- `engines`
- `os`
- `cpu`
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
- `fesm2022`
- `fesm2020`
- `fesm2015`
- `esm2020`
- `es2020`

### [TypeScript](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- `types`
- `typings`
- `typesVersions`

### Bundlers (Webpack, Rollup, esbuild)
- [`module`](https://stackoverflow.com/questions/42708484/what-is-the-module-package-json-field-for)
- [`sideEffects`](https://webpack.js.org/guides/tree-shaking/)

</details>

## Agent Skills

This package ships with [agent skills](https://agentskills.io) for AI coding assistants. Set up [`skills-npm`](https://github.com/antfu/skills-npm) to use them.
