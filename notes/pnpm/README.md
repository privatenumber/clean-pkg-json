# pnpm

pnpm behavior that clean-pkg-json depends on.

- [pack-and-publish.md](./pack-and-publish.md): `pnpm pack` reads `package.json` after `prepack` and then applies `publishConfig` overrides. pnpm 11+ does not tell lifecycle scripts about dry runs.
