# `package.json` fields TypeScript reads

TypeScript's module resolver reads `typings`, `types`, `typesVersions`, `main`, `tsconfig`, `type`, `imports`, `exports`, `name`, and the dependency fields from a package. TypeScript 7.1 also reads a top-level `typescript` field from content mapper packages.

Last verified 2026-11-02 against TypeScript 5.9.3 and TypeScript 7.1 beta ([`v7.1-beta`](https://github.com/microsoft/TypeScript/tree/v7.1-beta), commit `3e9236361fa97a9e6c685f4833ac457ae2d8c50a`).

## Resolution fields

Sources: [`PackageJsonPathFields`, 5.9.3 moduleNameResolver.ts#L336-L348](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L336-L348), and the same field list in the 7.1 Go port ([`tsc/internal/packagejson/packagejson.go#L9-L28`](https://github.com/microsoft/TypeScript/blob/v7.1-beta/tsc/internal/packagejson/packagejson.go#L9-L28)).

- **`typings`, `types`**: the type entry point. TypeScript reads `typings` first, then `types` ([#L394-L397](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L394-L397)).
- **`typesVersions`**: redirects type lookups by compiler version ([#L407-L408](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L407-L408)).
- **`tsconfig`**: read when a `tsconfig.json` `extends` a package name ([#L399-L401](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L399-L401)). A shared-config package can use it to point at its config file.
- **`exports`, `imports`**: in the `node16`, `nodenext`, and `bundler` resolvers, TypeScript adds the `types` condition to the conditions it matches ([#L767-L773](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L767-L773)).

## `typescript.contentMapper` (TypeScript 7.1)

A content mapper is a plugin that turns a file type TypeScript does not understand, such as `.vue` or `.astro`, into virtual TypeScript with mappings back to the original file. TypeScript 7.1 beta introduced content mappers ([announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/), 2026-10-20). A project registers a mapper package in `tsconfig.json`:

```json
{
    "contentMappers": [
        {
            "package": "@vue/content-mapper",
            "extensions": [
                ".vue"
            ]
        }
    ]
}
```

TypeScript resolves that package from `node_modules` and reads its `package.json`. The mapper package must declare a top-level `typescript.contentMapper` object. The design write-up states: "The package.json of the content mapper package must specify a `typescript` top-level field with a nested `contentMapper` field describing how to spawn the mapper process and what compiler options its transform requires" ([microsoft/typescript-go#4712](https://github.com/microsoft/typescript-go/pull/4712), merged 2026-08-19).

- **Fields read** at `v7.1-beta`: `exec` (required, the command that starts the mapper), `compilerOptions`, `dynamicConfig`, and `outputExtensions` ([`packagejson.go#L117-L145`](https://github.com/microsoft/TypeScript/blob/v7.1-beta/tsc/internal/packagejson/packagejson.go#L117-L145)). `outputExtensions` was added in [#64581](https://github.com/microsoft/TypeScript/pull/64581) (merged 2026-10-13).
- **Identity**: the package `name` and `version` form the mapper's identity for incremental builds and process sharing ([`contentmapper.go#L41-L51`](https://github.com/microsoft/TypeScript/blob/v7.1-beta/tsc/internal/contentmapper/contentmapper.go#L41-L51)).
- **Failure if missing**: TypeScript reports `The_package_json_of_the_content_mapper_package_0_does_not_declare_a_typescript_contentMapper_object` and does not use the mapper ([`tsoptions/contentmappers.go#L61-L66`](https://github.com/microsoft/TypeScript/blob/v7.1-beta/tsc/internal/tsoptions/contentmappers.go#L61-L66)).
- **Real use**: published mapper packages set it, for example `@vue/content-mapper`, `@astrojs/ts-content-mapper`, and `ember-content-mapper` (`npm view <package> typescript`, 2026-11-02). `@astrojs/ts-content-mapper` returns `{"contentMapper":{"exec":["node","dist/server.js"],"dynamicConfig":false,"compilerOptions":[]}}`.

Stability: 7.1 is in beta, and open PRs are still adding manifest fields (for example [#65047](https://github.com/microsoft/TypeScript/pull/65047)). The nested fields can change before the final release. The top-level `typescript` key is the stable part for this note.
