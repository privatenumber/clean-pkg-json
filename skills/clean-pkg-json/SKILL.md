---
name: clean-pkg-json
description: Cleans package.json for npm publishing using an allowlist approach — preserves only consumer-relevant properties. Use when setting up prepack hooks, configuring npm publish workflows, or working with clean-pkg-json flags.
---

# clean-pkg-json

Publishes only consumer-relevant `package.json` properties using an allowlist.

## Setup

Run it in `prepack`, after the build:

```json
{
    "scripts": {
        "prepack": "pnpm build && clean-pkg-json"
    }
}
```

## Rules

- Run the build before `clean-pkg-json`, in the same `prepack` script.
- Don't run `clean-pkg-json` as a separate step before other tools, such as `clean-pkg-json && changeset publish`. Use `prepack`. If it must run first, keep what those tools read: `clean-pkg-json --keep packageManager`.
- Don't restore `package.json` in `postpack`.
- After a local `npm pack`, restore the file with `git checkout package.json`.
- Preview the cleaned `package.json` with `clean-pkg-json --dry`. It prints the result without writing.
- Don't trust the sizes, shasum, or integrity from `npm pack --dry-run`. The tool doesn't change `package.json` during an npm dry run, so npm reports the original file.
- For the real shasum and integrity, run `npm pack --json`, then `git checkout package.json`.

### Why

- `exports` and `imports` entries are removed when their files aren't in the package. Unbuilt files look missing, so their entries get removed, with a warning.
- The tool rewrites `package.json` in place and keeps no copy. Every later command in the checkout sees the cleaned file. Without `packageManager`, Corepack falls back to its default version, so a Yarn 4 project runs later tools with Yarn 1.
- npm reads `package.json` again after `postpack` to build the registry metadata. A restore there publishes the uncleaned metadata.
- `--dry` and npm's dry run are separate modes. Under `npm pack --dry-run` or `npm publish --dry-run`, npm still runs `prepack` and builds the tarball in memory. The tool detects `npm_config_dry_run`, prints the cleaned result, prints a note to stderr, and doesn't write, so npm packs the original file. npm packs only the file on disk, and a `postpack` restore doesn't run if the pack fails or is interrupted, so there is no safe way to pack the cleaned file in a dry run.

## Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-k, --keep` | Preserve additional properties | `clean-pkg-json -k eslintConfig,devDependencies` |
| `-r, --remove` | Drop default-kept properties | `clean-pkg-json -r scripts.postinstall` |
| `-d, --dry` | Print the cleaned `package.json` without writing it | `clean-pkg-json --dry` |
| `-v, --verbose` | Log which properties are kept and removed | `clean-pkg-json --verbose` |
| `--published-only=false` | Don't prune `exports` and `imports` | `clean-pkg-json --published-only=false` |

Both `--keep` and `--remove` accept multiple flags (`-k foo -k bar`) or comma-delimited lists (`-k foo,bar`).

## Behavior

The tool reads `./package.json` in the current directory, keeps only allowlisted properties, prunes `exports` and `imports` entries for unpublished files, and writes the result back in place.

### Scripts Handling

Scripts use dot-notation in the allowlist. Only install hooks are preserved by default:

- `scripts.preinstall`
- `scripts.install`
- `scripts.postinstall`

To preserve additional scripts:

```sh
clean-pkg-json --keep scripts.prepare
```

If no scripts remain after filtering, the `scripts` key itself is omitted.

## Default Allowlist

| Category | Properties |
|----------|------------|
| npm required | `name`, `version`, `private`, `publishConfig` |
| Entry points | `main`, `bin`, `directories`, `browser`, `man`, `files` |
| Dependencies | `dependencies`, `peerDependencies`, `peerDependenciesMeta`, `bundleDependencies`, `bundledDependencies`, `optionalDependencies` |
| Node.js ESM | `type`, `exports`, `imports` |
| Environment | `engines`, `os`, `cpu`, `libc` |
| Native addons | `gypfile`, `binary` |
| Metadata | `description`, `keywords`, `author`, `maintainers`, `contributors`, `license`, `homepage`, `repository`, `bugs`, `funding` |
| TypeScript | `types`, `typings`, `typesVersions`, `typescript` |
| Bundlers | `module`, `sideEffects` |
| CDNs | `jsdelivr`, `unpkg` |
| VSCode extensions | `sponsor`, `publisher`, `displayName`, `categories`, `galleryBanner`, `preview`, `contributes`, `activationEvents`, `badges`, `markdown`, `qna`, `extensionPack`, `extensionDependencies`, `extensionKind`, `icon` |
| Angular | `fesm2020`, `fesm2015`, `esm2020`, `es2020` |
