# npm

npm behavior that clean-pkg-json depends on.

- [pack-and-publish.md](./pack-and-publish.md): When `npm pack` and `npm publish` read `package.json` relative to `prepack`, the checks that use the re-read manifest, why git dependencies do not run `prepack`, and why a `postpack` restore leaks the original manifest to the registry.
- [package-json-fields.md](./package-json-fields.md): Fields npm reads from an installed dependency, with experiments for `gypfile`, `directories`, and `libc`, and fields with little or no consumer effect.
