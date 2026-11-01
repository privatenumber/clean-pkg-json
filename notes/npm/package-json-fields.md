# `package.json` fields npm reads from a dependency

When npm installs a package, it reads some fields from that package's manifest. This note records the fields whose effect is not obvious from npm's documentation, and the fields that have no effect for a consumer.

Last verified 2026-11-02 against npm 12.2.1 ([`v12.2.1`](https://github.com/npm/cli/tree/v12.2.1)). The npm documentation lines cited here are in [`docs/lib/content/configuring-npm/package-json.md`](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md) at that tag.

## Install scripts

- npm runs a dependency's `preinstall`, `install`, and `postinstall` scripts. It runs `prepare` only for non-registry sources such as git ([`arborist/lib/install-scripts.js#L49-L63`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/install-scripts.js#L49-L63)).
- npm runs the `predependencies`, `dependencies`, and `postdependencies` scripts only for the root project, `this.actualTree.target`, after `node_modules` changes ([`arborist/lib/arborist/reify.js#L275-L293`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/reify.js#L275-L293)). They never run for an installed dependency. npm 8 has the same code ([`v8.19.4 reify.js#L1537-L1549`](https://github.com/npm/cli/blob/v8.19.4/workspaces/arborist/lib/arborist/reify.js#L1537-L1549)).
- npm passes `name`, `version`, `config`, `engines`, and `bin` to scripts as `npm_package_*` environment variables ([`@npmcli/run-script/lib/package-envs.js#L21-L30`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/run-script/lib/package-envs.js#L21-L30)). So a dependency's install script can read its own `config` and `engines`.

## `gypfile`

When a dependency has `binding.gyp` and no `install` or `preinstall` script, npm adds `node-gyp rebuild` as its install script, unless `gypfile` is `false` ([`arborist/lib/arborist/rebuild.js#L276-L283`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/rebuild.js#L276-L283), [`install-scripts.js#L65-L71`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/install-scripts.js#L65-L71), docs [#L549](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L549)).

Experiment: a package with `binding.gyp` (`{ 'targets': [] }`), `index.js`, and `"gypfile": false` was packed twice: once unchanged, and once with `gypfile` removed by a `prepack` script (clean-pkg-json at commit `3ef26b6a5f923765f74d360812a9f1fff44cce1d`). Each tarball was installed into another package with `npm install <tarball>`.

- With `gypfile: false`: no install-script output.
- Without `gypfile`: `npm warn install-scripts   gyp@1.0.0 (install: node-gyp rebuild)`. npm 12 blocked the script because it was not approved, but it detected one.

## `directories`

npm expands `directories.bin` into `bin`, and `directories.man` into `man`, only when the field is present and the explicit field is not ([`@npmcli/package-json/lib/normalize.js#L464-L490`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L464-L490), docs [#L466](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L466)).

Experiment: a package with an executable `bin/hello` and `"directories": {"bin": "bin"}` was packed with and without `directories` (removed by the same `prepack` script), then installed from the tarball. With `directories`, `node_modules/.bin/hello` exists. Without it, `node_modules/.bin` does not exist.

## `os`, `cpu`, and `libc`

npm-install-checks rejects a package whose `os`, `cpu`, or `libc` does not match the environment ([`npm-install-checks/lib/index.js#L25-L40`](https://github.com/npm/cli/blob/v12.2.1/node_modules/npm-install-checks/lib/index.js#L25-L40)). `libc` "only applies if `os` is `linux`" (docs [#L1179](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L1179)). npm-install-checks added `libc` support in v6.1.0 ([release](https://github.com/npm/npm-install-checks/releases/tag/v6.1.0)).

Native-binary packages publish one package per platform and use these fields to select one. For example, `@rollup/rollup-linux-x64-musl`, `@swc/core-linux-x64-musl`, `@oxc-parser/binding-linux-x64-musl`, and `lightningcss-linux-x64-musl` all set `"os": ["linux"], "cpu": ["x64"], "libc": ["musl"]` (`npm view <package> os cpu libc`).

Experiment with npm-install-checks 9.0.0, from an npm/cli checkout at `v12.2.1`:

```js
const { checkPlatform } = require('./node_modules/npm-install-checks')

const env = {
    os: 'linux',
    cpu: 'x64',
    libc: 'glibc'
}
checkPlatform({
    name: 'musl-binary',
    version: '1.0.0',
    os: ['linux'],
    cpu: ['x64'],
    libc: ['musl']
}, false, env)
// throws EBADPLATFORM
checkPlatform({
    name: 'musl-binary',
    version: '1.0.0',
    os: ['linux'],
    cpu: ['x64']
}, false, env)
// no error
```

## `bundleDependencies` spelling

`bundleDependencies` is the canonical spelling. "If this is spelled `"bundledDependencies"`, then that is also honored" (docs [#L833](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L833)). npm normalizes the alternate spelling to the canonical one and reports it as "incorrect" ([`normalize.js#L211-L217`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L211-L217)). npm-packlist reads the field at pack time, see [pack-and-publish.md](./pack-and-publish.md#experiment-a-prepack-script-decides-the-bundled-dependencies).

## Fields with little or no consumer effect

- **`man`**: "As of npm v12, man pages are no longer registered with the system `man` program. This field is retained for backward compatibility with package metadata and tools that consume it" (docs [#L402](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L402)).
- **`maintainers`**: "npm also sets a top-level "maintainers" field with your npm user info" (docs [#L215](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L215)). Whether the registry keeps a value from `package.json` was not tested.
