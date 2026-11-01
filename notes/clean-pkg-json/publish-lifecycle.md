# Publish lifecycle integration

clean-pkg-json rewrites `package.json` on disk. It is meant to run in the `prepack` script. Its output is the manifest that npm and pnpm use for everything they do after `prepack`: they compute the file list from it, apply `publishConfig` from it, and send it to the registry. A property that a pack or publish step reads after `prepack` must survive the cleanup, even if no consumer reads it at install time.

Last verified 2026-11-02 against npm 12.2.1 ([`v12.2.1`](https://github.com/npm/cli/tree/v12.2.1), commit `ae98c62586b6fea44114f72e249e246a2981de70`), pnpm 12.16.1, and Node.js 26.13.0.

## npm reads `package.json` before and after `prepack`

`npm pack` and `npm publish` read the manifest more than once.

1. **Before `prepack`.** libnpmpack reads the manifest, then runs `prepack` with that manifest ([`libnpmpack/lib/index.js#L20`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpack/lib/index.js#L20), [`#L60-L69`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpack/lib/index.js#L60-L69)). `npm publish` also reads it before `prepublishOnly` and applies `publishConfig` to the options at that point ([`lib/commands/publish.js#L97`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L97), [`#L319-L334`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L319-L334)).
2. **After `prepack`, for the file list.** The directory fetcher loads a fresh Arborist tree from disk and passes it to npm-packlist ([`pacote/lib/dir.js#L76-L82`](https://github.com/npm/cli/blob/v12.2.1/node_modules/pacote/lib/dir.js#L76-L82)). npm-packlist reads `files` and `bundleDependencies` from that tree's package ([`npm-packlist/lib/index.js#L440-L446`](https://github.com/npm/cli/blob/v12.2.1/node_modules/npm-packlist/lib/index.js#L440-L446)). So the cleaned `files` and `bundleDependencies` decide what goes into the tarball.
3. **After `prepack`, for the registry.** `npm publish` reads the manifest again after packing. The source comment states the purpose: "The purpose of re-reading the manifest is in case it changed, so that we send the latest and greatest thing to the registry note that publishConfig might have changed as well!" ([`lib/commands/publish.js#L126-L127`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L126-L127)). This read uses `PackageJson.prepare()` ([`#L304-L311`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L304-L311)). That step expands `directories.bin`/`directories.man` and adds a synthetic `node-gyp rebuild` install script when a `*.gyp` file exists and `gypfile` is not `false` ([`@npmcli/package-json/lib/normalize.js#L403-L413`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L403-L413), [`#L464-L490`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L464-L490)). libnpmpublish refuses a manifest with `private: true` ([`libnpmpublish/lib/publish.js#L15-L18`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpublish/lib/publish.js#L15-L18)), and this check uses the re-read manifest.

Consequences for the allowlist:

- `files`, `bundleDependencies`, `private`, and `publishConfig` are read after `prepack`. They must be kept even though consumers do not need them at runtime.
- Inputs to `prepare()` (`directories`, `gypfile`) change the registry manifest. Removing them changes what consumers receive, so both are kept. See [property-vetting.md](./property-vetting.md#install).

Experiment: when clean-pkg-json removes the canonical `bundleDependencies` spelling, npm omits the bundled dependency from the tarball. The allowlist at commit `3ef26b6a5f923765f74d360812a9f1fff44cce1d` removed it. The current allowlist keeps both spellings.

```sh
# in an empty directory, with node_modules/dep/{package.json,index.js} present
echo '{"name":"pkg","version":"1.0.0","dependencies":{"dep":"1.0.0"},"bundleDependencies":["dep"],"scripts":{"prepack":"node /path/to/clean-pkg-json/dist/index.mjs"}}' > package.json
npm pack --silent && tar -tzf pkg-1.0.0.tgz
```

| Spelling | `prepack` | Tarball contents |
| --- | --- | --- |
| `bundleDependencies` | `true` (no-op) | `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json` |
| `bundleDependencies` | clean-pkg-json at `3ef26b6` | `package/package.json` |
| `bundleDependencies` | clean-pkg-json, current | `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json` |
| `bundledDependencies` | `true` (no-op) | `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json` |
| `bundledDependencies` | clean-pkg-json | `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json` |

## pnpm reads `package.json` after `prepack`

Observed with pnpm 12.16.1. `pnpm pack` packs the cleaned manifest and then applies `publishConfig` overrides to it:

```sh
echo '{"name":"pp","version":"1.0.0","description":"d","publishConfig":{"main":"dist.js"},"main":"src.js","eslintConfig":{},"scripts":{"prepack":"node /path/to/clean-pkg-json/dist/index.mjs"}}' > package.json
touch src.js dist.js
pnpm pack && tar -xOzf pp-1.0.0.tgz package/package.json
```

```json
{
    "name": "pp",
    "version": "1.0.0",
    "description": "d",
    "main": "dist.js"
}
```

`eslintConfig` and `scripts` are gone, so pnpm used the cleaned file. `main` is `dist.js`, so pnpm applied `publishConfig` after the cleanup. If clean-pkg-json removed `publishConfig`, pnpm's field overrides would not apply.

Yarn was not tested. This is an evidence gap.

## Why `prepack`, not `prepublishOnly`

`prepack` runs for both `npm pack` and `npm publish` ([`libnpmpack/lib/index.js#L60-L69`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpack/lib/index.js#L60-L69)). `prepublishOnly` runs only for `npm publish` ([`lib/commands/publish.js#L103-L110`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L103-L110)). With `prepack`, the tarball from `npm pack` is the same as the published tarball. The build must run first in the same script (`"prepack": "pnpm build && clean-pkg-json"`), because [path pruning](./path-pruning.md) reads the files on disk. This repository uses that order in its own `prepack` script.

## Git dependencies do not run `prepack`

npm's documentation says `prepack` "Runs BEFORE a tarball is packed (on "`npm pack`", "`npm publish`", and when installing a git dependency)" ([`docs/lib/content/using-npm/scripts.md#L63-L64`](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/using-npm/scripts.md#L63-L64)). The source and an experiment disagree with the git dependency part.

- For a git dependency, pacote runs `npm install` in the clone, then packs it with the directory fetcher ([`pacote/lib/git.js#L160-L201`](https://github.com/npm/cli/blob/v12.2.1/node_modules/pacote/lib/git.js#L160-L201)). The directory fetcher runs only `prepare` ([`pacote/lib/dir.js#L33-L61`](https://github.com/npm/cli/blob/v12.2.1/node_modules/pacote/lib/dir.js#L33-L61)).
- Experiment with npm 12.2.1: a local git repository had `"prepare": "node prepare.js"` (writes a `prepared` file) and `"prepack": "node strip.js"` (deletes `eslintConfig`). After `npm install --allow-git=all git+file://<repo>`, `node_modules/gitdep` contained the `prepared` file, and its `package.json` still contained `"eslintConfig":{}`. So `prepare` ran and `prepack` did not.

Consequence: a package installed from git gets the uncleaned `package.json`. Only npm 12.2.1 was tested. Older npm versions are an evidence gap.

## npm dry runs

When `npm_config_dry_run` is `true`, clean-pkg-json does not write the file ([`src/index.ts`](../../src/index.ts), `isDryRun`). npm sets this variable for `npm pack --dry-run` and `npm publish --dry-run`. The result is that a dry run lists the uncleaned `package.json` in the tarball contents, so the dry run does not show what a real pack produces. Issue [#31](https://github.com/privatenumber/clean-pkg-json/issues/31) requests a dry run that shows the cleaned manifest. Use `clean-pkg-json --dry` to see the cleaned manifest without writing it.
