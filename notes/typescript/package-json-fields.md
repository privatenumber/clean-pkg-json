# `package.json` fields TypeScript reads

TypeScript's module resolver reads these fields from a package ([`PackageJsonPathFields`, moduleNameResolver.ts#L336-L348](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L336-L348)): `typings`, `types`, `typesVersions`, `main`, `tsconfig`, `type`, `imports`, `exports`, `name`, and the dependency fields.

Last verified 2026-11-02 against TypeScript 5.9.3.

- **`typings`, `types`**: the type entry point. TypeScript reads `typings` first, then `types` ([#L394-L397](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L394-L397)).
- **`typesVersions`**: redirects type lookups by compiler version ([#L407-L408](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L407-L408)).
- **`tsconfig`**: read when a `tsconfig.json` `extends` a package name ([#L399-L401](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L399-L401)). A shared-config package can use it to point at its config file.
- **`exports`, `imports`**: in the `node16`, `nodenext`, and `bundler` resolvers, TypeScript adds the `types` condition to the conditions it matches ([#L767-L773](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/moduleNameResolver.ts#L767-L773)).
