# clean-pkg-json

Script to remove unnecessary properties from `package.json` on prepublish hook.

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## Why?

`package.json` is primarily for declaring an npm package and describing how it can be consumed.

However, it can often get bloated with development concerns such as `devDependencies` and configuration like [`eslintConfig`](https://eslint.org/docs/latest/user-guide/configuring/), [`prettier`](https://prettier.io/docs/en/configuration.html), [`lint-staged`](https://github.com/okonet/lint-staged), [`simple-git-hooks`](https://github.com/toplenboren/simple-git-hooks), etc.

Use `clean-pkg-json` in a prepublish hook to remove unnecessary properties from `package.json`. Useful in micropackages where every byte matters.

## Usage

Add `clean-pkg-json` to the [`prepack` hook](https://docs.npmjs.com/cli/v8/using-npm/scripts#:~:text=on%20npm%20publish.-,prepack,-Runs%20BEFORE%20a), which runs before `npm publish` and `npm pack`.


```json5
// package.json
{
    "name": "my-package",
    // ...
    "scripts": {
        // ...
        "prepack": "clean-pkg-json"
    }
}
```

### Flags
| Flag | Description |
| - | - |
| `-k, --keep <property name>` | Property names to keep. Accepts multiple flags or a comma-delimited list. |
| `-v, --verbose` | Verbose logs. |
| `-d, --dry` | Dry run mode. Instead of writing to disk, it will log it. |
| `-h, --help` | Show help |
| `--version` | Show version |

### Default preserved properties
By default, these properties are preserved in `package.json`:

#### npm
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
- `contributors`
- `license`
- `homepage`
- `repository`
- `bugs`
- `donate`
- `funding`
- `sponsor`

#### CDN
- `jsdelivr`
- `unpkg`

#### Node.js
- `type`
- `exports`
- `imports`

#### Angular Package Format
- `fesm2020`
- `fesm2015`
- `esm2020`
- `es2020`

#### TypeScript
- `types`
- `typings`

#### Bundlers (Webpack, Rollup, esbuild)
- `module`
- `sideEffects`
