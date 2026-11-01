# Pack and publish: when npm reads `package.json`

`npm pack` and `npm publish` read `package.json` before the `prepack` script and again after it. The reads after `prepack` decide the tarball file list and the manifest sent to the registry. So a `prepack` script that rewrites `package.json` changes both.

Last verified 2026-11-02 against npm 12.2.1 ([`v12.2.1`](https://github.com/npm/cli/tree/v12.2.1), commit `ae98c62586b6fea44114f72e249e246a2981de70`) on Node.js 26.13.0.

## The reads in order

1. **Before `prepack`.** libnpmpack reads the manifest, then runs `prepack` with that manifest ([`libnpmpack/lib/index.js#L20`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpack/lib/index.js#L20), [`#L60-L69`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpack/lib/index.js#L60-L69)). `npm publish` also reads it before `prepublishOnly` and applies `publishConfig` to the options at that point ([`lib/commands/publish.js#L97`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L97), [`#L319-L334`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L319-L334)).
2. **After `prepack`, for the file list.** The directory fetcher loads a fresh Arborist tree from disk and passes it to npm-packlist ([`pacote/lib/dir.js#L76-L82`](https://github.com/npm/cli/blob/v12.2.1/node_modules/pacote/lib/dir.js#L76-L82)). npm-packlist reads `files` and `bundleDependencies` from that tree's package ([`npm-packlist/lib/index.js#L440-L446`](https://github.com/npm/cli/blob/v12.2.1/node_modules/npm-packlist/lib/index.js#L440-L446)).
3. **After `prepack`, for the registry.** `npm publish` reads the manifest again after packing. The source comment states the purpose: "The purpose of re-reading the manifest is in case it changed, so that we send the latest and greatest thing to the registry note that publishConfig might have changed as well!" ([`lib/commands/publish.js#L126-L127`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L126-L127)). This read applies `publishConfig` again and uses `PackageJson.prepare()` ([`#L304-L311`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L304-L311)).

`PackageJson.prepare()` derives fields for the registry manifest:

- It expands `directories.bin` into `bin` and `directories.man` into `man` ([`@npmcli/package-json/lib/normalize.js#L464-L490`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L464-L490)).
- It adds `"install": "node-gyp rebuild"` when a `*.gyp` file exists, no `install` or `preinstall` script exists, and `gypfile` is not `false` ([`normalize.js#L403-L413`](https://github.com/npm/cli/blob/v12.2.1/node_modules/@npmcli/package-json/lib/normalize.js#L403-L413)).

## Checks that use the re-read manifest

- **`private`**: libnpmpublish throws `EPRIVATE` for `private: true` ([`libnpmpublish/lib/publish.js#L15-L18`](https://github.com/npm/cli/blob/v12.2.1/workspaces/libnpmpublish/lib/publish.js#L15-L18)).
- **`packageExtensions`**: npm refuses to publish a non-private package that has it: "packageExtensions is only honored at the project root and must not be published" ([`lib/commands/publish.js#L288-L297`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L288-L297)). npm checks both the first read and the re-read.

## Experiment: a `prepack` script decides the bundled dependencies

Setup: an empty directory with `node_modules/dep/{package.json,index.js}`, and this `package.json`. The `prepack` script removes fields from `package.json`. It was clean-pkg-json at commit `3ef26b6a5f923765f74d360812a9f1fff44cce1d`, which removed `bundleDependencies` and kept `bundledDependencies`.

```sh
echo '{"name":"pkg","version":"1.0.0","dependencies":{"dep":"1.0.0"},"bundleDependencies":["dep"],"scripts":{"prepack":"<script>"}}' > package.json
npm pack --silent && tar -tzf pkg-1.0.0.tgz
```

| Field in source `package.json` | `prepack` removes it | Tarball contents |
| --- | --- | --- |
| `bundleDependencies` | no (`"prepack": "true"`) | `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json` |
| `bundleDependencies` | yes | `package/package.json` |
| `bundledDependencies` | no (`"prepack": "true"`) | `package/node_modules/dep/index.js package/node_modules/dep/package.json package/package.json` |

The result confirms read 2: npm-packlist uses the manifest as it is after `prepack`.

## Git dependencies do not run `prepack`

npm's documentation says `prepack` "Runs BEFORE a tarball is packed (on "`npm pack`", "`npm publish`", and when installing a git dependency)" ([`docs/lib/content/using-npm/scripts.md#L63-L64`](https://github.com/npm/cli/blob/v12.2.1/docs/lib/content/using-npm/scripts.md#L63-L64)). The source and an experiment disagree with the git dependency part.

- For a git dependency, pacote runs `npm install` in the clone, then packs the clone with the directory fetcher ([`pacote/lib/git.js#L160-L201`](https://github.com/npm/cli/blob/v12.2.1/node_modules/pacote/lib/git.js#L160-L201)). The directory fetcher runs only `prepare` ([`pacote/lib/dir.js#L33-L61`](https://github.com/npm/cli/blob/v12.2.1/node_modules/pacote/lib/dir.js#L33-L61)).
- Experiment: a local git repository had `"prepare": "node prepare.js"` (writes a `prepared` file) and `"prepack": "node strip.js"` (deletes `eslintConfig`). After `npm install --allow-git=all git+file://<repo>`, `node_modules/gitdep` contained the `prepared` file, and its `package.json` still contained `"eslintConfig":{}`. So `prepare` ran and `prepack` did not.

Only npm 12.2.1 was tested. Older npm versions are an evidence gap.

## `prepublishOnly` runs only for publish

`prepublishOnly` runs in `npm publish` ([`lib/commands/publish.js#L103-L110`](https://github.com/npm/cli/blob/v12.2.1/lib/commands/publish.js#L103-L110)), not in libnpmpack. `prepack` runs in libnpmpack, so it runs for both `npm pack` and `npm publish`.
