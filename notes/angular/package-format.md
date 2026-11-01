# Angular Package Format: legacy resolution keys

The Angular Package Format (APF) is the layout of Angular library packages. Besides `exports`, APF defines top-level "legacy resolution keys" in `package.json` for resolvers that do not support `exports`. The set of keys changed in Angular 16.

Last verified 2026-11-02.

| Angular version | Legacy resolution keys | Evidence |
| --- | --- | --- |
| 13 to 15 | `fesm2020`, `fesm2015`, `esm2020`, `es2020`, `module`, `typings` | [15.2.0 angular-package-format.md#L203-L217](https://github.com/angular/angular/blob/15.2.0/aio/content/guide/angular-package-format.md#L203-L217). `npm view @angular/core@15.2.10 fesm2020 fesm2015 esm2020 es2020 module typings` returns all six. |
| 16 and later | `module`, `typings` | [16.0.0 angular-package-format.md#L173-L183](https://github.com/angular/angular/blob/16.0.0/aio/content/guide/angular-package-format.md#L173-L183), and the [current APF page](https://angular.dev/tools/libraries/angular-package-format#legacy-resolution-keys) (accessed 2026-11-02, built at Angular v22.2.4). `npm view @angular/core@16.0.0` and `npm view @angular/core@22` return only `module` and `typings`. |

The keys were documented as "considered deprecated" on the current page: "These keys are considered deprecated, and could be removed as the support for `"exports"` rolls out across the ecosystem."

## `fesm2022` is a directory, not a key

No APF version documents a top-level `fesm2022` key. In Angular 16 and later, `fesm2022/` is the directory that holds the flattened ES2022 bundles, and `package.json` references it through `module` and `exports` (for example, `"module": "./fesm2022/core.mjs"` in `@angular/core@22`).
