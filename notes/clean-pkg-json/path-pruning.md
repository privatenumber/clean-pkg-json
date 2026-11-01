# `exports` and `imports` path pruning

By default, clean-pkg-json removes `exports` and `imports` targets that point to files outside the published package. It removes only the unpublished branches of a conditional entry, and it removes the whole entry when no branch is left. `--published-only=false` turns this off. The implementation is [`src/prune-unpublished-paths.ts`](../../src/prune-unpublished-paths.ts), and the contract is locked by the `prune unpublished paths` suite in [`tests/index.ts`](../../tests/index.ts).

## Why prune

A package can map a custom condition to source files, for example a `development` condition that points into `src/` for local work. If `src/` is not published, a consumer who enables that condition resolves to a file that does not exist in `node_modules`. Issue [#5](https://github.com/privatenumber/clean-pkg-json/issues/5) states the motivation: "`imports` can be used to reference source files via conditions. However, this can be shipped to production and be accidentally used by the user setting their custom condition."

Node.js resolves a custom condition for any consumer who passes it with `--conditions` ([Node.js](../nodejs/package-json-fields.md#custom-conditions)). Targets that do not start with `./` are package specifiers or invalid paths. They are left unchanged.

## How the published file set is computed

The tool calls npm-packlist with the cleaned `packageJson` and an empty dependency edge map ([`getPublishedFiles`](../../src/prune-unpublished-paths.ts)). npm-packlist is the library npm uses to choose tarball files (see [npm/pack-and-publish.md](../npm/pack-and-publish.md#the-reads-in-order)), so the pruning matches npm's own file selection. Because it uses the cleaned manifest, the result also reflects the cleaned `files` field.

npm-packlist lists only files that exist on disk. So the pruning is correct only after the build. Running clean-pkg-json on an unbuilt checkout removes entries for build outputs that do not exist yet. This was reported in a [comment on #16](https://github.com/privatenumber/clean-pkg-json/pull/16#issuecomment-4601154491). In that report, the referenced files were never produced by the build, so the removal was correct, but the silent failure mode was confusing.

## Why a missing file causes a warning

Decision from [#22](https://github.com/privatenumber/clean-pkg-json/pull/22): a removed entry produces a warning when its target does not exist on disk, because that usually means the tool ran before the build. A removed entry whose target exists but is excluded from the package is the intended case, so it is silent.

The existence check runs only for removed targets. A concrete target costs one `stat`. A wildcard target reads only the directory before its first `*`, skips `node_modules` and `.git`, and caches the listing per directory. A target that resolves outside the package root counts as missing. The normal `prepack` case, where every target is built and published, does no file system work beyond npm-packlist. The tests `only reads the referenced directory for wildcards, not the whole tree` and `never touches the filesystem outside the package root` lock these limits.

## Wildcard matching

[`src/path-matcher.ts`](../../src/path-matcher.ts) decides whether a published file is a possible expansion of a `*` pattern. It follows Node's rules: `*` can contain `/`, every `*` in one target takes the same value, and a `*` captures at least one character ([Node.js](../nodejs/package-json-fields.md#subpath-patterns)).

The matcher is ported from [pkg-entry-points](https://github.com/privatenumber/pkg-entry-points). The port also validates the last segment of a multi-star pattern, which the original does not do. Single-star patterns behave the same in both. The `path matcher` suite in [`tests/index.ts`](../../tests/index.ts) covers both cases.
