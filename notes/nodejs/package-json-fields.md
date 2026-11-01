# `package.json` fields Node.js reads

Node.js defines five `package.json` fields: `name`, `main`, `type`, `exports`, and `imports` ([Node.js v26.13.0 field definitions](https://nodejs.org/docs/v26.13.0/api/packages.html#nodejs-packagejson-field-definitions)). The documentation says that other tools use "additional fields which are ignored by Node.js".

Last verified 2026-11-02 against Node.js 26.13.0.

## `packageManager`

Node.js v22.0.0 listed a sixth field: "`"packageManager"` - The package manager recommended when contributing to the package. Leveraged by the Corepack shims." ([v22.0.0 packages.md#L1120-L1121](https://github.com/nodejs/node/blob/v22.0.0/doc/api/packages.md#L1120-L1121)). The field list in v25.0.0 and later no longer includes it. Its documented purpose is contributor tooling for the project, not consumers of the published package.

## Custom conditions

Node.js ignores conditions other than `import`, `require`, `node`, `module-sync`, `node-addons`, and `default`, unless the user enables them with `--conditions` ([Resolving user conditions](https://nodejs.org/docs/v26.13.0/api/packages.html#resolving-user-conditions)). So an `exports` branch for a custom condition such as `development` is reachable by any consumer who passes that condition.

## Subpath patterns

In `exports` and `imports`, `*` is a string replacement that can contain `/`. All instances of `*` in a target are replaced with the same value ([Subpath patterns](https://nodejs.org/docs/v26.13.0/api/packages.html#subpath-patterns)). The resolver matches a pattern key only when `packageSubpath.length >= key.length`, and the key length includes the `*`, so the `*` captures at least one character ([`lib/internal/modules/esm/resolve.js#L598-L606`](https://github.com/nodejs/node/blob/v26.13.0/lib/internal/modules/esm/resolve.js#L598-L606)).
