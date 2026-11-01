# Default property vetting

clean-pkg-json keeps a property by default only when something reads it from the published package. Everything else is removed. This note defines that rule, gives the checklist for adding a property to [`src/default-keep-properties.ts`](../../src/default-keep-properties.ts), and records the evidence for every property in the list.

Last verified 2026-11-02 against npm 12.2.1 ([`v12.2.1`](https://github.com/npm/cli/tree/v12.2.1)), pnpm 12.16.1, Node.js 26.13.0, and TypeScript 5.9.3, starting from clean-pkg-json commit `3ef26b6a5f923765f74d360812a9f1fff44cce1d`. The allowlist changes from that vetting are listed in [History](#history-allowlist-changes-from-the-2026-11-02-vetting).

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
2. **Primary source.** Link the tool's documentation or source at a release tag or commit, with line anchors. Put research with experiments or several sources in the owner's folder, such as `notes/npm/`, and link it from this note. Cite a single-source fact inline.
3. **Real use.** Name at least one published package that sets the property for that reader, for example with `npm view <package> <property>`.
4. **Failure if removed.** State what breaks for a consumer, or what changes in the tarball or registry manifest.
5. **Development-only check.** Confirm that the reader is not only a tool in the author's own repository. If it is, the property stays opt-in through `--keep`.

A property that fails step 1 or step 4 is not added. Record it under [Evaluated and not kept](#evaluated-and-not-kept) with the reason.

## Kept properties

Each row names the reader and links to the evidence. Upstream research with experiments or several sources lives in the owner's folder (`notes/npm/`, `notes/pnpm/`, `notes/nodejs/`, `notes/typescript/`, `notes/angular/`). Single-source facts are cited inline.

Verdicts:

- **Required**: a reader is verified, and removal changes behavior.
- **Display**: a registry or marketplace shows it. Removal loses metadata but does not break installs.
- **Legacy**: a reader exists only in older tool versions.
- **No reader found**: kept, but no reader was found. Removal has no known effect.

### Pack and publish

These fields are read after `prepack`. See [publish-lifecycle.md](./publish-lifecycle.md#fields-that-must-survive-prepack) for why each one must survive.

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `name`, `version` | npm requires them to pack and publish. Node.js also uses `name` for self-reference ([Node.js](../nodejs/package-json-fields.md)). | Required |
| `private` | npm refuses to publish a private package, using the manifest re-read after `prepack` ([npm](../npm/pack-and-publish.md#checks-that-use-the-re-read-manifest)). | Required |
| `publishConfig` | npm applies it after `prepack` ([npm](../npm/pack-and-publish.md#the-reads-in-order)). pnpm applies its field overrides to the cleaned manifest ([pnpm](../pnpm/pack-and-publish.md)). | Required |
| `files` | npm-packlist reads it after `prepack` ([npm](../npm/pack-and-publish.md#the-reads-in-order)). [Path pruning](./path-pruning.md) also uses it. | Required |
| `bundleDependencies`, `bundledDependencies` | npm-packlist bundles the listed dependencies. `bundleDependencies` is canonical, and npm also honors the other spelling ([npm](../npm/package-json-fields.md#bundledependencies-spelling)). Removal silently drops the bundled dependencies ([experiment](../npm/pack-and-publish.md#experiment-a-prepack-script-decides-the-bundled-dependencies)). | Required |

### Install

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `dependencies`, `optionalDependencies`, `peerDependencies`, `peerDependenciesMeta` | Package managers resolve the dependency graph from them. | Required |
| `bin` | Package managers link executables from it. | Required |
| `directories` | npm expands `directories.bin` into `bin` and `directories.man` into `man`. Removal stops linking executables for a package that has no `bin` ([npm experiment](../npm/package-json-fields.md#directories)). | Required |
| `man` | npm 12 no longer registers man pages with the system `man` program ([npm](../npm/package-json-fields.md#fields-with-little-or-no-consumer-effect)). | Legacy for npm 12 and later |
| `engines` | npm checks it at install time and passes it to install scripts as `npm_package_engines_*` ([npm](../npm/package-json-fields.md#install-scripts)). VS Code requires `engines.vscode` ([extension manifest](https://code.visualstudio.com/api/references/extension-manifest), accessed 2026-11-02). | Required |
| `os`, `cpu`, `libc` | npm rejects a package built for another platform. Native-binary packages such as `@rollup/rollup-linux-x64-musl` depend on this. Without `libc`, a musl-only package is accepted on glibc systems ([npm experiment](../npm/package-json-fields.md#os-cpu-and-libc)). | Required |
| `scripts.preinstall`, `scripts.install`, `scripts.postinstall` | npm runs them for installed dependencies ([npm](../npm/package-json-fields.md#install-scripts)). | Required |
| `gypfile` | `"gypfile": false` stops npm from adding a `node-gyp rebuild` install script when the package has `binding.gyp`. Removal gives every consumer that build script ([npm experiment](../npm/package-json-fields.md#gypfile)). | Required |
| `binary` | Install scripts that use prebuild-install or node-pre-gyp read it from the package's own `package.json`. prebuild-install selects a prebuilt Node-API binary only when the version is in `binary.napi_versions`: [`napi-build-utils index.js#L5`](https://github.com/inspiredware/napi-build-utils/blob/v2.0.0/index.js#L5) reads `package.json` from the working directory, [`#L57-L65`](https://github.com/inspiredware/napi-build-utils/blob/v2.0.0/index.js#L57-L65) checks `binary.napi_versions`, and [`prebuild-install bin.js#L5-L8`](https://github.com/prebuild/prebuild-install/blob/v7.1.3/bin.js#L5-L8) uses it. node-pre-gyp reports `binary` as missing without it ([`versioning.js#L207-L214`](https://github.com/mapbox/node-pre-gyp/blob/v2.0.3/lib/util/versioning.js#L207-L214)). `canvas` and `sqlite3` set `binary.napi_versions` with `prebuild-install -r napi \|\| node-gyp rebuild`. Inferred effect of removal, not run: the prebuilt download is skipped and the package compiles from source. | Required |

### Registry display

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `description`, `keywords`, `author`, `contributors`, `license`, `homepage`, `repository`, `bugs` | npmjs.com and the npm CLI (`npm repo`, `npm bugs`, `npm docs`) read them from the registry manifest, which is the cleaned file. | Display |
| `funding` | `npm fund` reads it from installed packages. | Display |
| `maintainers` | Added in [#6](https://github.com/privatenumber/clean-pkg-json/pull/6). npm documents that it sets this field itself ([npm](../npm/package-json-fields.md#fields-with-little-or-no-consumer-effect)). | No reader found |

### Node.js and TypeScript resolution

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `type`, `main`, `exports`, `imports` | The fields Node.js defines ([Node.js](../nodejs/package-json-fields.md)). TypeScript reads them too ([TypeScript](../typescript/package-json-fields.md)). `exports` and `imports` are also pruned, see [path-pruning.md](./path-pruning.md). | Required |
| `types`, `typings`, `typesVersions` | TypeScript's type entry point and version redirects ([TypeScript](../typescript/package-json-fields.md)). | Required |
| `typescript` | TypeScript 7.1 reads `typescript.contentMapper` from a content mapper package to learn how to start the mapper. Without it, TypeScript reports that the package "does not declare a typescript.contentMapper object" and does not use the mapper. Published mappers such as `@vue/content-mapper` and `@astrojs/ts-content-mapper` set it ([TypeScript](../typescript/package-json-fields.md#typescriptcontentmapper-typescript-71)). TypeScript 7.1 is in beta, so the nested fields can still change. | Required |

### Bundlers and CDNs

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `browser` | Default main field for webpack web targets ([resolve.mdx#L54](https://github.com/webpack/webpack.js.org/blob/a1b4b8dd0563406d548097562b6997179b9a5c86/src/content/configuration/resolve.mdx#L54)), Vite client builds ([`constants.ts#L38-L43`](https://github.com/vitejs/vite/blob/v8.3.5/packages/vite/src/node/constants.ts#L38-L43)), and Metro ([Configuration.md#L254-L264](https://github.com/facebook/metro/blob/v0.87.2/docs/Configuration.md#L254-L264)). jsDelivr uses it as the second default-file field. | Required |
| `module` | Default main field for webpack, Vite, and Rollup's node-resolve ([README.md#L110](https://github.com/rollup/plugins/blob/node-resolve-v9.0.0/packages/node-resolve/README.md#L110)). Also an Angular legacy key ([Angular](../angular/package-format.md)). | Required |
| `sideEffects` | webpack tree shaking ([tree-shaking.mdx#L159](https://github.com/webpack/webpack.js.org/blob/a1b4b8dd0563406d548097562b6997179b9a5c86/src/content/guides/tree-shaking.mdx#L159)). Added in [#3](https://github.com/privatenumber/clean-pkg-json/pull/3) for issue [#2](https://github.com/privatenumber/clean-pkg-json/issues/2). | Required |
| `jsdelivr` | jsDelivr default file, "with `jsdelivr` having the highest priority" ([README.md#L283-L287](https://github.com/jsdelivr/jsdelivr/blob/5a3f39db3032bbb366d72c74e8a0ac133977877b/README.md#L283-L287)). | Required |
| `unpkg` | UNPKG default file: "a package can choose its UNPKG default with the `unpkg` field" ([README.md#L11](https://github.com/unpkg/unpkg/blob/69d2013ebcfdc441f6cf89c4a61f42af94bfe173/README.md#L11)). | Required |

### Angular Package Format

| Property | Reader and effect | Verdict |
| --- | --- | --- |
| `fesm2020`, `fesm2015`, `esm2020`, `es2020` | Legacy resolution keys in Angular 13 to 15 packages. Angular 16 and later use only `module` and `typings` ([Angular](../angular/package-format.md)). Added in [#4](https://github.com/privatenumber/clean-pkg-json/pull/4) for issue [#1](https://github.com/privatenumber/clean-pkg-json/issues/1). | Legacy |

### VS Code extension manifest

Source: [extension manifest reference](https://code.visualstudio.com/api/references/extension-manifest), accessed 2026-11-02. VS Code reads these fields from the installed extension or shows them in the Marketplace.

| Property | Verdict |
| --- | --- |
| `publisher` (required), `contributes`, `activationEvents`, `extensionPack`, `extensionDependencies`, `extensionKind` | Required |
| `displayName`, `categories`, `galleryBanner`, `preview`, `badges`, `markdown`, `qna`, `sponsor`, `icon` | Display |

Evidence gap: `vsce` packages extensions without `npm pack`, and this note does not verify that `vsce` reads `package.json` after a user's clean step. The VS Code fields matter only when the cleaned file is the one that `vsce` packages.

## History: allowlist changes from the 2026-11-02 vetting

The first full vetting changed the default list. This section records why, because the earlier list is in released versions.

- **Added** `bundleDependencies`, `gypfile`, `directories`, `libc`, `binary`, and `typescript`. Each has a reader in the tables above. Before this change, clean-pkg-json removed them. The linked npm experiments show the effect of that removal for the first four. The effect for `binary` and `typescript` comes from source only. After the change, the `bundleDependencies` experiment was re-run with the new build, and the tarball matched the no-op control. The other experiments were not re-run.
- **Removed** `scripts.dependencies`. npm runs the `dependencies` script only for the root project, never for an installed dependency, in both npm 8 and npm 12 ([npm](../npm/package-json-fields.md#install-scripts)). The allowlist had listed it as an "npm 8" install hook, but it never ran for consumers.
- **Removed** `fesm2022`, added in [#9](https://github.com/privatenumber/clean-pkg-json/pull/9). No Angular Package Format version defines it as a top-level key ([Angular](../angular/package-format.md#fesm2022-is-a-directory-not-a-key)).
- **Not changed**: `napi`. It has the same shape as `binary` (read by the package's own install script), but it was declined in [#8](https://github.com/privatenumber/clean-pkg-json/pull/8), and this vetting did not revisit that decision. See [Evaluated and not kept](#evaluated-and-not-kept).

The test `keeps fields that tools read from the published package` in [`tests/index.ts`](../../tests/index.ts) locks the added fields and the `scripts.dependencies` removal.

## Evaluated and not kept

| Property | Reader | Reason it is not a default |
| --- | --- | --- |
| `napi` | napi-postinstall reads it at install time. | Declined in [#8](https://github.com/privatenumber/clean-pkg-json/pull/8): "typically the `napi` property _should_ be removed because it's only a development concern". napi-postinstall users can use `--keep napi`. `binary` is now a default and has the same shape, so this decision is open to a new evaluation. |
| `scripts.dependencies` | npm, only for the root project. | Removed from the defaults. See [History](#history-allowlist-changes-from-the-2026-11-02-vetting). |
| `fesm2022` | None found. | Removed from the defaults. See [History](#history-allowlist-changes-from-the-2026-11-02-vetting). |
| `packageManager` | Corepack, in the project root. Node.js documented it as a setting for contributors ([Node.js](../nodejs/package-json-fields.md#packagemanager)). | It is a contributor setting, not a consumer setting. Issue [#32](https://github.com/privatenumber/clean-pkg-json/issues/32) (open) reports that a release script running `clean-pkg-json && changeset publish` makes Corepack fall back to Yarn Classic. The failure comes from running other tools in the same checkout after the cleanup, not from consumers. |
| `packageExtensions` | npm, only at the project root. | npm 12 refuses to publish a non-private package that has it ([npm](../npm/pack-and-publish.md#checks-that-use-the-re-read-manifest)). Removing it is correct. |
| `config` | npm passes it to the package's own scripts as `npm_package_config_*`, including install scripts ([npm](../npm/package-json-fields.md#install-scripts)). | Not evaluated further. A dependency's install script that reads `npm_package_config_*` would need `--keep config`. No published example was found. |
| `tsconfig` | TypeScript reads it when a `tsconfig.json` `extends` a package ([TypeScript](../typescript/package-json-fields.md)). | Candidate. A shared-config package that uses it would break `extends`. No published example was checked. |
| `style` | webpack CSS `@import` resolution uses `mainFields: ['style', '...']` ([resolve.mdx#L258](https://github.com/webpack/webpack.js.org/blob/a1b4b8dd0563406d548097562b6997179b9a5c86/src/content/configuration/resolve.mdx#L258)). | Candidate. Not evaluated against published packages. |
| `react-native` | Metro under React Native: `resolverMainFields` defaults to `['react-native', 'browser', 'main']` ([Configuration.md#L264](https://github.com/facebook/metro/blob/v0.87.2/docs/Configuration.md#L264)). | Candidate. Not evaluated against published packages. |
| `jsnext:main`, `jsnext` | Vite default main fields, with the source comment "moment still uses this..." ([`constants.ts#L38-L43`](https://github.com/vitejs/vite/blob/v8.3.5/packages/vite/src/node/constants.ts#L38-L43)). | Candidate, legacy. Not evaluated against published packages. |
| `capabilities`, `pricing` | VS Code extension manifest fields ([reference](https://code.visualstudio.com/api/references/extension-manifest), accessed 2026-11-02). `capabilities` declares support for untrusted and virtual workspaces. | Candidate. Missing from the VS Code group, subject to the `vsce` evidence gap above. |
