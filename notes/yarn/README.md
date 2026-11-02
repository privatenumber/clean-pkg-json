# Yarn

Yarn behavior that clean-pkg-json depends on.

- [pack-and-publish.md](./pack-and-publish.md): Yarn 4 reloads `package.json` after `prepack`, builds the tarball and registry manifest from it, and decides whether to run `postpack` from it. It does not tell lifecycle scripts about dry runs.
