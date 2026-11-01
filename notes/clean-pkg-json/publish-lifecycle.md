# Publish lifecycle integration

clean-pkg-json rewrites `package.json` on disk, and it is meant to run in the `prepack` script. npm and pnpm read `package.json` again after `prepack`. So the cleaned file decides the tarball file list, the `publishConfig` that applies, and the manifest sent to the registry. A property that a pack or publish step reads after `prepack` must survive the cleanup, even if no consumer reads it at install time.

Upstream evidence:

- npm: [npm/pack-and-publish.md](../npm/pack-and-publish.md)
- pnpm: [pnpm/pack-and-publish.md](../pnpm/pack-and-publish.md)
- Yarn was not tested. This is an evidence gap.

## Fields that must survive `prepack`

| Field | Why it must survive | Evidence |
| --- | --- | --- |
| `files` | npm-packlist reads it after `prepack` to choose tarball files. | [npm read 2](../npm/pack-and-publish.md#the-reads-in-order) |
| `bundleDependencies`, `bundledDependencies` | npm-packlist reads it after `prepack`. Without it, bundled dependencies are silently left out of the tarball. | [npm experiment](../npm/pack-and-publish.md#experiment-a-prepack-script-decides-the-bundled-dependencies) |
| `private` | npm refuses to publish a private package, and the check uses the re-read manifest. Removing it would let a private package publish. | [npm checks](../npm/pack-and-publish.md#checks-that-use-the-re-read-manifest) |
| `publishConfig` | npm applies it again after `prepack`, and pnpm applies its field overrides to the cleaned manifest. | [npm read 3](../npm/pack-and-publish.md#the-reads-in-order), [pnpm](../pnpm/pack-and-publish.md) |
| `directories`, `gypfile` | npm derives `bin`, `man`, and a `node-gyp rebuild` install script from them for the registry manifest. | [npm `prepare()`](../npm/pack-and-publish.md#the-reads-in-order) |

After the change that added `bundleDependencies` to the defaults, the npm experiment was re-run with the current CLI build: the tarball contains `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json`, the same as the no-op `prepack` control.

## Why `prepack`, not `prepublishOnly`

`prepack` runs for both `npm pack` and `npm publish`. `prepublishOnly` runs only for `npm publish` ([npm](../npm/pack-and-publish.md#prepublishonly-runs-only-for-publish)). With `prepack`, the tarball from `npm pack` is the same as the published tarball. This was the recommendation in a [comment on #16](https://github.com/privatenumber/clean-pkg-json/pull/16#issuecomment-4601154491).

The build must run first in the same script (`"prepack": "pnpm build && clean-pkg-json"`), because [path pruning](./path-pruning.md) reads the files on disk. This repository uses that order in its own `prepack` script.

## Git installs get the uncleaned file

npm 12.2.1 does not run `prepack` when it installs a git dependency, although npm's documentation says that it does ([npm](../npm/pack-and-publish.md#git-dependencies-do-not-run-prepack)). So a consumer who installs a package from git gets the uncleaned `package.json`. clean-pkg-json cannot fix this from `prepack`.

## npm dry runs

When `npm_config_dry_run` is `true`, clean-pkg-json does not write the file ([`src/index.ts`](../../src/index.ts), `isDryRun`). npm exports every non-default config value to lifecycle scripts as an `npm_config_*` variable ([`config/lib/set-envs.js#L1-L12`](https://github.com/npm/cli/blob/v12.2.1/workspaces/config/lib/set-envs.js#L1-L12), [`#L48-L89`](https://github.com/npm/cli/blob/v12.2.1/workspaces/config/lib/set-envs.js#L48-L89)), so `npm pack --dry-run` and `npm publish --dry-run` set it. As a result, a dry run lists the uncleaned `package.json` in the tarball contents, so the dry run does not show what a real pack produces. Issue [#31](https://github.com/privatenumber/clean-pkg-json/issues/31) requests a dry run that shows the cleaned manifest. Use `clean-pkg-json --dry` to see the cleaned manifest without writing it.
