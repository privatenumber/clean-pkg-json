---
name: clean-pkg-json
description: Cleans package.json for npm publishing using an allowlist approach — preserves only consumer-relevant properties. Use when setting up prepack hooks, configuring npm publish workflows, or working with clean-pkg-json flags.
---

# clean-pkg-json

Publishes only consumer-relevant `package.json` properties using an allowlist.

## Setup

```json
{
    "scripts": {
        "prepack": "clean-pkg-json"
    }
}
```

When chaining with other prepack commands:

```json
{
    "scripts": {
        "prepack": "pnpm build && clean-pkg-json"
    }
}
```

## Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-k, --keep` | Preserve additional properties | `clean-pkg-json -k eslintConfig,devDependencies` |
| `-r, --remove` | Drop default-kept properties | `clean-pkg-json -r scripts.postinstall` |
| `-d, --dry` | Preview result without writing to disk | `clean-pkg-json --dry` |
| `-v, --verbose` | Log details about which properties are preserved | `clean-pkg-json --verbose` |

Both `--keep` and `--remove` accept multiple flags (`-k foo -k bar`) or comma-delimited lists (`-k foo,bar`).

Use `--dry` to preview changes before writing.

`npm pack --dry-run` and `npm publish --dry-run` are also auto-detected (via `npm_config_dry_run`) — no write happens when npm itself is in dry-run mode.

## Behavior

The tool reads `./package.json` in the current directory, keeps only allowlisted properties, and writes the result back in place.

### Scripts Handling

Scripts use dot-notation in the allowlist. Only install hooks are preserved by default:

- `scripts.preinstall`
- `scripts.install`
- `scripts.postinstall`
- `scripts.dependencies`

To preserve additional scripts:

```sh
clean-pkg-json --keep scripts.prepare
```

If no scripts remain after filtering, the `scripts` key itself is omitted.

## Default Allowlist

| Category | Properties |
|----------|------------|
| npm required | `name`, `version`, `private`, `publishConfig` |
| Entry points | `main`, `bin`, `browser`, `man`, `files` |
| Dependencies | `dependencies`, `peerDependencies`, `peerDependenciesMeta`, `bundledDependencies`, `optionalDependencies` |
| Node.js ESM | `type`, `exports`, `imports` |
| Environment | `engines`, `os`, `cpu` |
| Metadata | `description`, `keywords`, `author`, `maintainers`, `contributors`, `license`, `homepage`, `repository`, `bugs`, `funding` |
| TypeScript | `types`, `typings`, `typesVersions` |
| Bundlers | `module`, `sideEffects` |
| CDNs | `jsdelivr`, `unpkg` |
| VSCode extensions | `sponsor`, `publisher`, `displayName`, `categories`, `galleryBanner`, `preview`, `contributes`, `activationEvents`, `badges`, `markdown`, `qna`, `extensionPack`, `extensionDependencies`, `extensionKind`, `icon` |
| Angular | `fesm2022`, `fesm2020`, `fesm2015`, `esm2020`, `es2020` |
