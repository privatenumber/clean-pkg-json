# Pack and publish: when Yarn reads `package.json`

Yarn 4 reloads `package.json` from disk after the `prepack` script. It builds the packed manifest and the registry manifest from that reloaded file, and it decides whether to run `postpack` from the reloaded file too. A `prepack` script that rewrites `package.json` therefore decides the tarball and the registry metadata. A `postpack` script runs only if it is still present after the rewrite.

Last verified 2026-11-02 against Yarn 4.18.1 ([`@yarnpkg/cli/4.18.1`](https://github.com/yarnpkg/berry/tree/@yarnpkg/cli/4.18.1), commit `ef4519ec740912d361a090eb75c4ebd0b76a038b`), run through Corepack 0.36.0 on Node.js 26.13.0.

## Source

- `prepareForPack` runs `prepack`, reloads the manifest with `workspace.manifest.loadFile(...)`, runs the pack callback, and then runs `postpack` in a `finally` block ([`plugin-pack/sources/packUtils.ts#L56-L68`](https://github.com/yarnpkg/berry/blob/@yarnpkg/cli/4.18.1/packages/plugin-pack/sources/packUtils.ts#L56-L68)).
- `genPackageManifest` copies `workspace.manifest.raw`, which is the reloaded manifest ([`packUtils.ts#L144-L154`](https://github.com/yarnpkg/berry/blob/@yarnpkg/cli/4.18.1/packages/plugin-pack/sources/packUtils.ts#L144-L154)).
- `yarn npm publish` builds the publish body and sends it inside the `prepareForPack` callback, so before `postpack` ([`plugin-npm-cli/sources/commands/npm/publish.ts#L130-L192`](https://github.com/yarnpkg/berry/blob/@yarnpkg/cli/4.18.1/packages/plugin-npm-cli/sources/commands/npm/publish.ts#L130-L192)).

## Experiments

Setup for both: a Yarn 4 project with `"packageManager": "yarn@4.18.1"`, an empty `yarn.lock` installed with `yarn install`, and `eslintConfig` as a field that the cleanup removes. The cleanup was clean-pkg-json at commit `f135dcf`, which removes `packageManager`, `eslintConfig`, and `scripts`. Commands ran as `npx corepack@0.36.0 yarn ...`.

**`yarn pack` uses the file as it is after `prepack`.** With `"prepack": "node <clean-pkg-json>"`, the tarball's `package.json` was `{"name":"yarn4-pkg","version":"1.0.0"}`. The file on disk stayed in that cleaned state after the command finished.

**`yarn npm publish` sends the cleaned manifest, and skips a `postpack` that the cleanup removed.** With `"prepack": "node backup.js && node <clean-pkg-json>"` and `"postpack": "node restore.js"` (copy `package.json` to a backup, then rename it back), `yarn npm publish` to a local HTTP server that records the PUT request gave:

- Registry manifest keys: `["name","version","_id","dist"]`.
- Tarball `package.json`: `{"name":"yarn-restore-test","version":"1.0.0"}`.
- `package.json` on disk: still cleaned. `package.json.bak` still existed, so `postpack` did not run. The reloaded manifest no longer had `scripts.postpack`.

Compare npm, which runs `postpack` from the manifest it read before `prepack`, and which reads the manifest for the registry after `postpack` ([npm/pack-and-publish.md](../npm/pack-and-publish.md#postpack-runs-before-the-registry-re-read)).
