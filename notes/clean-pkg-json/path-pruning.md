# `exports` and `imports` path pruning

By default, clean-pkg-json removes `exports` and `imports` targets that point to files outside the published package. It removes only the unpublished branches of a conditional entry, and it removes the whole entry when no branch is left. `--published-only=false` turns this off. The implementation is [`src/prune-unpublished-paths.ts`](../../src/prune-unpublished-paths.ts), and the contract is locked by the `prune unpublished paths` suite in [`tests/index.ts`](../../tests/index.ts).

## Why prune

A package can map a custom condition to source files, for example a `development` condition that points into `src/` for local work. If `src/` is not published, a consumer who enables that condition resolves to a file that does not exist in `node_modules`. Issue [#5](https://github.com/privatenumber/clean-pkg-json/issues/5) states the motivation: "`imports` can be used to reference source files via conditions. However, this can be shipped to production and be accidentally used by the user setting their custom condition."

Node.js resolves custom conditions when the user passes `--conditions`, and it applies `exports` to self-references and to `node_modules` lookups ([Node.js v26.13.0 packages documentation, "Resolving user conditions"](https://nodejs.org/docs/v26.13.0/api/packages.html#resolving-user-conditions)). Targets that do not start with `./` are package specifiers or invalid paths. They are left unchanged.

## How the published file set is computed

The tool calls npm-packlist with the cleaned `packageJson` and an empty dependency edge map ([`getPublishedFiles`](../../src/prune-unpublished-paths.ts)). npm-packlist is the library npm uses to choose tarball files (see [publish-lifecycle.md](./publish-lifecycle.md#npm-reads-packagejson-before-and-after-prepack)), so the pruning matches npm's own file selection. Because it uses the cleaned manifest, the result also reflects the cleaned `files` field.

npm-packlist lists only files that exist on disk. So the pruning is correct only after the build. Running clean-pkg-json on an unbuilt checkout removes entries for build outputs that do not exist yet. This was reported in a [comment on #16](https://github.com/privatenumber/clean-pkg-json/pull/16#issuecomment-4601154491). In that report, the referenced files were never produced by the build, so the removal was correct, but the silent failure mode was confusing.

## Why a missing file causes a warning

Decision from [#22](https://github.com/privatenumber/clean-pkg-json/pull/22): a removed entry produces a warning when its target does not exist on disk, because that usually means the tool ran before the build. A removed entry whose target exists but is excluded from the package is the intended case, so it is silent.

The existence check runs only for removed targets. A concrete target costs one `stat`. A wildcard target reads only the directory before its first `*`, skips `node_modules` and `.git`, and caches the listing per directory. A target that resolves outside the package root counts as missing. The normal `prepack` case, where every target is built and published, does no file system work beyond npm-packlist. The tests `only reads the referenced directory for wildcards, not the whole tree` and `never touches the filesystem outside the package root` lock these limits.

## Wildcard matching

[`src/path-matcher.ts`](../../src/path-matcher.ts) decides whether a published file is a possible expansion of a `*` pattern. It follows Node's rule that `*` is a string replacement that can contain `/`, and that every `*` in one target takes the same value ([Node.js v26.13.0, "Subpath patterns"](https://nodejs.org/docs/v26.13.0/api/packages.html#subpath-patterns)). A `*` must capture at least one character. Node's resolver enforces this on the request side: it matches a pattern key only when `packageSubpath.length >= key.length`, and the key length includes the `*` ([`lib/internal/modules/esm/resolve.js#L598-L606`](https://github.com/nodejs/node/blob/v26.13.0/lib/internal/modules/esm/resolve.js#L598-L606)).

The matcher is ported from [pkg-entry-points](https://github.com/privatenumber/pkg-entry-points). The port also validates the last segment of a multi-star pattern, which the original does not do. Single-star patterns behave the same in both. The `path matcher` suite in [`tests/index.ts`](../../tests/index.ts) covers both cases.
