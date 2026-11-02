# Publish lifecycle integration

clean-pkg-json rewrites `package.json` on disk, and it is meant to run in the `prepack` script. npm and pnpm read `package.json` again after `prepack`. So the cleaned file decides the tarball file list, the `publishConfig` that applies, and the manifest sent to the registry. A property that a pack or publish step reads after `prepack` must survive the cleanup, even if no consumer reads it at install time.

Upstream evidence:

- npm: [npm/pack-and-publish.md](../npm/pack-and-publish.md)
- pnpm: [pnpm/pack-and-publish.md](../pnpm/pack-and-publish.md)
- Yarn 4: [yarn/pack-and-publish.md](../yarn/pack-and-publish.md)

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

### Rejected: write and restore during a dry run

Issue #31 wants the shasum and integrity of the real tarball ahead of time. Those hashes cover the tarball bytes, and npm packs the `package.json` on disk. So a dry run that reports them must write the cleaned file and then restore it.

Prototype, with npm 12.2.1: `prepack` copied `package.json` to a backup only when `npm_config_dry_run` was `true`, then ran clean-pkg-json with the variable cleared. `postpack` renamed the backup back.

| Run | Tarball `package.json` | shasum |
| --- | --- | --- |
| `npm pack --dry-run`, current behavior | 181 B (original) | `f2d5d427...` |
| `npm pack --dry-run`, prototype | 79 B (cleaned) | `41c249cf...` |
| `npm publish --dry-run`, prototype | 79 B | `41c249cf...` |
| `npm pack` | 79 B | `41c249cf...` |

After each prototype dry run, `package.json` on disk was byte-identical to the original. npm runs `postpack` from the manifest it read before `prepack`, so the cleanup removing `scripts.postpack` did not stop the restore.

It works, but it was rejected because the two halves are separate commands that nothing ties together:

- libnpmpack does not run `postpack` in a `finally` block ([`libnpmpack/lib/index.js#L60-L106`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpack/lib/index.js#L60-L106)). A failed or interrupted pack leaves the cleaned file and the backup on disk.
- The restore cannot prove that a backup came from the current run.
- In a real publish, a restore in `postpack` leaks the uncleaned metadata to the registry ([npm](../npm/pack-and-publish.md#postpack-runs-before-the-registry-re-read)). The design depends on dry-run detection never being wrong.

The supported way is a real pack: `npm pack --json` prints `shasum` and `integrity` for the real tarball. Then `git checkout package.json` restores the file, or the pack runs in a disposable checkout.

Reconsider if npm adds a lifecycle hook that runs on every exit path of a pack, or a way to pack a manifest that is not on disk.

## The cleaned file stays on disk

clean-pkg-json does not restore `package.json`. After it runs, every later command in the same checkout sees the cleaned file. This matters when a later command reads a project setting that the cleanup removed, such as `packageManager`.

Issue [#32](https://github.com/privatenumber/clean-pkg-json/issues/32) is an example. A release script runs `clean-pkg-json && changeset publish` in a Yarn 4 project:

1. clean-pkg-json removes `packageManager` from `package.json`.
2. `changeset publish` (`@changesets/cli` 3.0.3) runs `yarn --version` in the project root to choose a publish tool, and it rejects Yarn 1 with "Yarn Classic is not supported" ([`getPublishTool.ts#L9-L18`](https://github.com/changesets/changesets/blob/%40changesets/cli%403.0.3/packages/cli/src/commands/publish/getPublishTool.ts#L9-L18), [`#L47-L54`](https://github.com/changesets/changesets/blob/%40changesets/cli%403.0.3/packages/cli/src/commands/publish/getPublishTool.ts#L47-L54)).
3. Without `packageManager`, Corepack's `yarn` runs its default Yarn 1. Observed with Corepack 0.36.0: `corepack yarn --version` printed `4.18.1` in a directory whose `package.json` has `"packageManager": "yarn@4.18.1"`, and `1.22.22` in a directory without the field.

Running clean-pkg-json in `prepack` changes the order but not the file state. `changeset publish` chooses its publish tool before it publishes any package ([`publish/index.ts#L121`](https://github.com/changesets/changesets/blob/%40changesets/cli%403.0.3/packages/cli/src/commands/publish/index.ts#L121)), and Yarn runs `prepack` during the publish. So the detection sees the original file. Afterward, the file is still cleaned: after `yarn pack` with clean-pkg-json in `prepack`, `corepack yarn --version` printed `1.22.22` ([yarn experiment](../yarn/pack-and-publish.md#experiments)). The end-to-end `changeset publish` flow with `prepack` was not run.

### Restoring in `postpack` is unsafe with npm

A `postpack` script that restores the original file looks like a fix, but the package managers disagree on when they read the file:

- **npm** runs `postpack` before it re-reads the manifest for the registry. A restore in `postpack` makes npm publish the original, uncleaned manifest as registry metadata, including the removed `scripts`, while the tarball has the cleaned file ([npm experiment](../npm/pack-and-publish.md#postpack-runs-before-the-registry-re-read)).
- **Yarn 4** sends the registry manifest before `postpack`, but it decides whether to run `postpack` from the cleaned file. clean-pkg-json removes `scripts.postpack`, so the restore does not run unless it is kept with `--keep scripts.postpack` ([yarn experiment](../yarn/pack-and-publish.md#experiments)).
- **pnpm** was not tested.

So a restore needs a lifecycle point that runs after the registry upload, such as `postpublish`, and it still would not run for `npm pack` alone.
