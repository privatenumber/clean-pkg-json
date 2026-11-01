# Default property vetting

clean-pkg-json keeps a property by default only when something reads it from the published package. Everything else is removed. This note defines that rule, gives the checklist for adding a property to [`src/default-keep-properties.ts`](../../src/default-keep-properties.ts), and records the evidence for every property in the list.

Last verified 2026-11-02 against npm 12.2.1 ([`v12.2.1`](https://github.com/npm/cli/tree/v12.2.1)), pnpm 12.16.1, Node.js 26.13.0, and TypeScript 5.9.3, at clean-pkg-json commit `3ef26b6a5f923765f74d360812a9f1fff44cce1d`.

## The rule

A property is kept by default when at least one of these readers uses it from the published package:

1. **Pack and publish.** npm or pnpm reads it after `prepack`, so the cleaned file decides the tarball or the registry manifest. See [publish-lifecycle.md](./publish-lifecycle.md).
2. **Install.** A package manager reads it from a dependency's manifest, or a dependency's own install script reads it.
3. **Resolution and runtime.** Node.js, TypeScript, a bundler, a CDN, or a host such as VS Code reads it from the installed package.
4. **Registry and marketplace display.** npmjs.com, `npm fund`, or the VS Code Marketplace shows it.

A property that only configures development tools in the package's own repository (linters, test runners, Git hooks, `devDependencies`, most scripts) is removed. Users keep anything else with `--keep`, and they drop a default with `--remove` (added in [#9](https://github.com/privatenumber/clean-pkg-json/pull/9) for issue [#7](https://github.com/privatenumber/clean-pkg-json/issues/7), where a published `"preinstall": "npx only-allow npm"` broke consumers).

Third-party properties are defaults, not opt-in presets. Decision from issue [#1](https://github.com/privatenumber/clean-pkg-json/issues/1): presets were considered (`--preset angular`), but a property that a published package declares for a consumer-side tool is wanted in production. A preset would add a flag without changing the outcome.

## Checklist for a new property

Before you add a property to the default list, record these in this note:

1. **Reader.** Name the tool that reads it from the published package, and the phase from the rule above.
2. **Primary source.** Link the tool's documentation or source at a release tag or commit, with line anchors.
3. **Real use.** Name at least one published package that sets the property for that reader, for example with `npm view <package> <property>`.
4. **Failure if removed.** State what breaks for a consumer, or what changes in the tarball or registry manifest.
5. **Development-only check.** Confirm that the reader is not only a tool in the author's own repository. If it is, the property stays opt-in through `--keep`.

A property that fails step 1 or step 4 is not added. Record it under [Evaluated and not kept](#evaluated-and-not-kept) with the reason.

## Kept properties

Verdicts:

- **Required**: a reader is verified, and removal changes behavior.
- **Display**: a registry or marketplace shows it. Removal loses metadata but does not break installs.
- **Legacy**: a reader exists only in older tool versions.
- **No reader found**: kept, but no reader was found. Removal has no known effect.

### npm pack and publish

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `name`, `version` | Required by npm to pack and publish. Node.js uses `name` for package self-reference ([Node.js field definitions](https://nodejs.org/docs/v26.13.0/api/packages.html#nodejs-packagejson-field-definitions)). | Required |
| `private` | npm "will refuse to publish it" ([package-json.md#L1224](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L1224)). The refusal uses the manifest that is re-read after `prepack` ([`libnpmpublish/lib/publish.js#L15-L18`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpublish/lib/publish.js#L15-L18)). Removing it would let a private package publish. | Required |
| `publishConfig` | npm applies it to publish options before and after `prepack` ([`lib/commands/publish.js#L319-L334`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L319-L334)). pnpm applies its field overrides to the cleaned manifest (experiment in [publish-lifecycle.md](./publish-lifecycle.md#pnpm-reads-packagejson-after-prepack)). | Required |
| `files` | npm-packlist reads it after `prepack` to choose tarball files ([publish-lifecycle.md](./publish-lifecycle.md#npm-reads-packagejson-before-and-after-prepack)). Path pruning also uses it. | Required |
| `bundledDependencies` | npm-packlist bundles the listed dependencies. npm treats this spelling as a typo of `bundleDependencies` and normalizes it ([`normalize.js#L211-L217`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L211-L217)). The canonical spelling is a gap, see below. | Required |

### Install

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `dependencies`, `optionalDependencies`, `peerDependencies`, `peerDependenciesMeta` | Package managers resolve the dependency graph from them. | Required |
| `bin` | Package managers link executables from it. | Required |
| `man` | npm installs man pages from it. "As of npm v12, man pages are no longer registered with the system `man` program. This field is retained for backward compatibility with package metadata and tools that consume it" ([package-json.md#L402](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L402)). | Legacy for npm 12 and later |
| `engines` | npm checks it with npm-install-checks and passes it to scripts as `npm_package_engines_*` ([`run-script/lib/package-envs.js#L21-L30`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/run-script/lib/package-envs.js#L21-L30)). VS Code requires `engines.vscode` ([extension manifest](https://code.visualstudio.com/api/references/extension-manifest), accessed 2026-11-02). | Required |
| `os`, `cpu` | npm-install-checks rejects a package for another platform ([`npm-install-checks/lib/index.js#L25-L40`](https://github.com/npm/cli/blob/v12.2.1/node_modules/npm-install-checks/lib/index.js#L25-L40)). Platform-specific optional packages depend on this. | Required |
| `scripts.preinstall`, `scripts.install`, `scripts.postinstall` | npm runs these for installed dependencies ([`arborist/lib/install-scripts.js#L49-L60`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/install-scripts.js#L49-L60)). | Required |
| `scripts.dependencies` | npm runs `dependencies` only for the root project, `this.actualTree.target`, never for an installed dependency ([`arborist/lib/arborist/reify.js#L275-L293`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/reify.js#L275-L293)). npm 8 has the same code ([`v8.19.4 reify.js#L1537-L1549`](https://github.com/npm/cli/blob/v8.19.4/workspaces/arborist/lib/arborist/reify.js#L1537-L1549)). The source comment "npm 8" in the allowlist treats it as an install hook, but it does not run for consumers. | No reader found |

### Registry display

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `description`, `keywords`, `author`, `contributors`, `license`, `homepage`, `repository`, `bugs` | npmjs.com and the npm CLI (`npm repo`, `npm bugs`, `npm docs`) read them from the registry manifest, which is the cleaned file. | Display |
| `funding` | `npm fund` reads it from installed packages. | Display |
| `maintainers` | Added in [#6](https://github.com/privatenumber/clean-pkg-json/pull/6). npm documents that it sets this field itself: "npm also sets a top-level "maintainers" field with your npm user info" ([package-json.md#L215](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L215)). Whether the registry keeps a value from `package.json` was not tested. | No reader found |

### Node.js and TypeScript resolution

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `type`, `main`, `exports`, `imports` | Node.js field definitions ([Node.js v26.13.0](https://nodejs.org/docs/v26.13.0/api/packages.html#nodejs-packagejson-field-definitions)). TypeScript reads the same fields ([`moduleNameResolver.ts#L336-L348`](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L336-L348)). `exports` and `imports` are also pruned, see [path-pruning.md](./path-pruning.md). | Required |
| `types`, `typings` | TypeScript reads `typings`, then `types` ([`moduleNameResolver.ts#L394-L397`](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L394-L397)). | Required |
| `typesVersions` | TypeScript reads it to redirect type lookups by compiler version ([`moduleNameResolver.ts#L407-L408`](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L407-L408)). | Required |

### Bundlers and CDNs

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `browser` | Default main field for webpack web targets ([resolve.mdx#L54](https://github.com/webpack/webpack.js.org/blob/a1b4b8dd0563406d548097562b6997179b9a5c86/src/content/configuration/resolve.mdx#L54)), Vite client builds ([`constants.ts#L38-L43`](https://github.com/vitejs/vite/blob/v8.3.5/packages/vite/src/node/constants.ts#L38-L43)), and Metro ([Configuration.md#L254-L264](https://github.com/facebook/metro/blob/v0.87.2/docs/Configuration.md#L254-L264)). jsDelivr uses it as the second default-file field. | Required |
| `module` | Default main field for webpack, Vite, and Rollup's node-resolve ([README.md#L110](https://github.com/rollup/plugins/blob/node-resolve-v9.0.0/packages/node-resolve/README.md#L110)). Also an APF legacy key. | Required |
| `sideEffects` | webpack tree shaking ([tree-shaking.mdx#L159](https://github.com/webpack/webpack.js.org/blob/a1b4b8dd0563406d548097562b6997179b9a5c86/src/content/guides/tree-shaking.mdx#L159)). Added in [#3](https://github.com/privatenumber/clean-pkg-json/pull/3) for issue [#2](https://github.com/privatenumber/clean-pkg-json/issues/2). | Required |
| `jsdelivr` | jsDelivr default file, "with `jsdelivr` having the highest priority" ([README.md#L283-L287](https://github.com/jsdelivr/jsdelivr/blob/5a3f39db3032bbb366d72c74e8a0ac133977877b/README.md#L283-L287)). | Required |
| `unpkg` | UNPKG default file: "a package can choose its UNPKG default with the `unpkg` field" ([README.md#L11](https://github.com/unpkg/unpkg/blob/69d2013ebcfdc441f6cf89c4a61f42af94bfe173/README.md#L11)). | Required |

### Angular Package Format

Added in [#4](https://github.com/privatenumber/clean-pkg-json/pull/4) (`fesm2020`, `fesm2015`, `esm2020`, `es2020`) and [#9](https://github.com/privatenumber/clean-pkg-json/pull/9) (`fesm2022`).

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `fesm2020`, `fesm2015`, `esm2020`, `es2020` | APF legacy resolution keys up to Angular 15 ([v15.2.0 angular-package-format.md#L203-L217](https://github.com/angular/angular/blob/15.2.0/aio/content/guide/angular-package-format.md#L203-L217)). From Angular 16, the legacy keys are only `module` and `typings` ([16.0.0 #L173-L183](https://github.com/angular/angular/blob/16.0.0/aio/content/guide/angular-package-format.md#L173-L183), and still in the [current APF](https://angular.dev/tools/libraries/angular-package-format#legacy-resolution-keys), accessed 2026-11-02). `npm view @angular/core@15.2.10` has all four keys. `npm view @angular/core@16.0.0` has none. | Legacy |
| `fesm2022` | No APF version documents a top-level `fesm2022` key, and `@angular/core@16.0.0` and `@angular/core@22` do not set it. `fesm2022` is a directory name, referenced through `module` and `exports`. | No reader found |

### VS Code extension manifest

Source: [extension manifest reference](https://code.visualstudio.com/api/references/extension-manifest), accessed 2026-11-02. VS Code reads these fields from the installed extension or shows them in the Marketplace.

| Property | Verdict |
| --- | --- |
| `publisher` (required), `contributes`, `activationEvents`, `extensionPack`, `extensionDependencies`, `extensionKind` | Required |
| `displayName`, `categories`, `galleryBanner`, `preview`, `badges`, `markdown`, `qna`, `sponsor`, `icon` | Display |

Evidence gap: `vsce` packages extensions without `npm pack`, and this note does not verify that `vsce` reads `package.json` after a user's clean step. The VS Code fields matter only when the cleaned file is the one that `vsce` packages.

## Gaps found by this vetting

These properties have a verified reader but are not in the default list. Removing them changes what consumers receive. They are findings, not decisions. Each needs a decision about the allowlist.

| Property | What breaks when it is removed | Evidence |
| --- | --- | --- |
| `bundleDependencies` | Bundled dependencies are silently left out of the tarball. This is npm's canonical spelling, and the kept `bundledDependencies` is the alternate spelling ([package-json.md#L833](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L833)). | Observed. See the experiment in [publish-lifecycle.md](./publish-lifecycle.md#npm-reads-packagejson-before-and-after-prepack). |
| `gypfile` | A package that ships `binding.gyp` and sets `"gypfile": false` without an install script gets a synthetic `node-gyp rebuild` install script for every consumer ([`arborist/lib/arborist/rebuild.js#L276-L283`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/rebuild.js#L276-L283), [`install-scripts.js#L65-L71`](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/install-scripts.js#L65-L71)). | Observed. Consumer install of the cleaned tarball printed `gyp@1.0.0 (install: node-gyp rebuild)` as a blocked install script. The uncleaned tarball printed nothing. |
| `directories` | `directories.bin` without `bin` stops linking executables. npm expands `directories.bin` into `bin` only when the field is present ([`normalize.js#L477-L490`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L477-L490)). | Observed. With a no-op `prepack`, `node_modules/.bin/hello` exists after installing the tarball. With clean-pkg-json, `node_modules/.bin` does not exist. |
| `libc` | A musl-only package is installed on glibc systems, and the reverse ([package-json.md#L1179](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/configuring-npm/package-json.md#L1179), [`npm-install-checks/lib/index.js#L32-L38`](https://github.com/npm/cli/blob/v12.2.1/node_modules/npm-install-checks/lib/index.js#L32-L38)). Platform packages use it: `@rollup/rollup-linux-x64-musl`, `@swc/core-linux-x64-musl`, `@oxc-parser/binding-linux-x64-musl`, and `lightningcss-linux-x64-musl` all set `"libc": ["musl"]`. | Observed with npm-install-checks 9.0.0: `checkPlatform` on a glibc Linux x64 environment throws `EBADPLATFORM` for the package with `libc`, and accepts the same package without it. |
| `binary` | Install scripts that use prebuild-install or node-pre-gyp read it from the package's own `package.json` at install time. prebuild-install selects a prebuilt Node-API binary only when the version is in `binary.napi_versions` ([`napi-build-utils index.js#L5`](https://github.com/inspiredware/napi-build-utils/blob/v2.0.0/index.js#L5) reads `package.json` from the working directory, and [`#L57-L65`](https://github.com/inspiredware/napi-build-utils/blob/v2.0.0/index.js#L57-L65) checks `binary.napi_versions`; prebuild-install uses it in [`prebuild-install bin.js#L5-L8`](https://github.com/prebuild/prebuild-install/blob/v7.1.3/bin.js#L5-L8)). node-pre-gyp reports `binary` as missing without it ([`versioning.js#L207-L214`](https://github.com/mapbox/node-pre-gyp/blob/v2.0.3/lib/util/versioning.js#L207-L214)). `canvas` and `sqlite3` set `binary.napi_versions` with `prebuild-install -r napi \|\| node-gyp rebuild`. | Source only. The inferred effect is that the prebuilt download is skipped and the package compiles from source. This was not run. |

Two kept properties also need a decision: `scripts.dependencies` and `fesm2022` have no reader. See their rows above.

## Evaluated and not kept

| Property | Reader | Reason it is not a default |
| --- | --- | --- |
| `napi` | napi-postinstall reads it at install time. | Declined in [#8](https://github.com/privatenumber/clean-pkg-json/pull/8): "typically the `napi` property _should_ be removed because it's only a development concern". napi-postinstall users can use `--keep napi`. This has the same shape as `binary` (read by the package's own install script), so a decision about `binary` should revisit it. |
| `packageManager` | Corepack, in the project root. Node.js v22.0.0 defined it as "The package manager recommended when contributing to the package" ([v22.0.0 packages.md#L1120](https://github.com/nodejs/node/blob/v22.0.0/doc/api/packages.md#L1120)). The v25.0.0 field list no longer includes it. | It is a contributor setting, not a consumer setting. Issue [#32](https://github.com/privatenumber/clean-pkg-json/issues/32) (open) reports that a release script running `clean-pkg-json && changeset publish` makes Corepack fall back to Yarn Classic. The failure comes from running other tools in the same checkout after the cleanup, not from consumers. |
| `packageExtensions` | npm, only at the project root. | npm 12.2.1 refuses to publish a non-private package that has it: "packageExtensions is only honored at the project root and must not be published" ([`lib/commands/publish.js#L288-L297`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L288-L297)). Removing it is correct. |
| `config` | npm passes it to the package's own scripts as `npm_package_config_*` ([`package-envs.js#L21-L30`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/run-script/lib/package-envs.js#L21-L30)), including install scripts. | Not evaluated further. A dependency's install script that reads `npm_package_config_*` would need `--keep config`. No published example was found. |
| `tsconfig` | TypeScript reads it when a `tsconfig.json` `extends` a package ([`moduleNameResolver.ts#L399-L401`](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L399-L401)). | Candidate. A shared-config package that uses it would break `extends`. No published example was checked. |
| `style` | webpack CSS `@import` resolution uses `mainFields: ['style', '...']` ([resolve.mdx#L258](https://github.com/webpack/webpack.js.org/blob/a1b4b8dd0563406d548097562b6997179b9a5c86/src/content/configuration/resolve.mdx#L258)). | Candidate. Not evaluated against published packages. |
| `react-native` | Metro under React Native: `resolverMainFields` defaults to `['react-native', 'browser', 'main']` ([Configuration.md#L264](https://github.com/facebook/metro/blob/v0.87.2/docs/Configuration.md#L264)). | Candidate. Not evaluated against published packages. |
| `jsnext:main`, `jsnext` | Vite default main fields, with the source comment "moment still uses this..." ([`constants.ts#L38-L43`](https://github.com/vitejs/vite/blob/v8.3.5/packages/vite/src/node/constants.ts#L38-L43)). | Candidate, legacy. Not evaluated against published packages. |
| `capabilities`, `pricing` | VS Code extension manifest fields ([reference](https://code.visualstudio.com/api/references/extension-manifest), accessed 2026-11-02). `capabilities` declares support for untrusted and virtual workspaces. | Candidate. Missing from the VS Code group, subject to the `vsce` evidence gap above. |

## How to re-run the experiments

All experiments use synthetic packages in a temporary directory, with the built CLI from `pnpm build` (`dist/index.mjs`) as the `prepack` script.

- `bundleDependencies`: the experiment and its output are in [publish-lifecycle.md](./publish-lifecycle.md#npm-reads-packagejson-before-and-after-prepack).
- `gypfile`: create `binding.gyp` (`{ 'targets': [] }`), `index.js`, and `{"name":"gyp","version":"1.0.0","gypfile":false,"scripts":{"prepack":"node <dist/index.mjs>"}}`. Run `npm pack`, then run `npm install ../gyp/gyp-1.0.0.tgz` in another package. npm 12.2.1 printed `npm warn install-scripts   gyp@1.0.0 (install: node-gyp rebuild)`. With `"prepack": "true"`, it printed no install-script warning.
- `directories`: create an executable `bin/hello` and `{"name":"dirbin","version":"1.0.0","directories":{"bin":"bin"},"scripts":{"prepack":"node <dist/index.mjs>"}}`. Pack it, install the tarball in another package, and run `ls node_modules/.bin`.
- `libc`: from an npm/cli checkout at `v12.2.1`, call `require('./node_modules/npm-install-checks').checkPlatform(pkg, false, { os: 'linux', cpu: 'x64', libc: 'glibc' })` with and without `libc: ['musl']` in `pkg`.
