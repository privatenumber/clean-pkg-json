# clean-pkg-json

Project policy and integration notes.

- [property-vetting.md](./property-vetting.md): The rule that decides which `package.json` properties are kept by default, the checklist for a new property, and the evidence for every property in [`src/default-keep-properties.ts`](../../src/default-keep-properties.ts). It also lists gaps and the candidates that were evaluated and not added.
- [publish-lifecycle.md](./publish-lifecycle.md): When npm and pnpm read `package.json` relative to the `prepack` script. This explains why clean-pkg-json runs in `prepack`, why pack-time fields must survive the cleanup, and where the tool does not run.
- [path-pruning.md](./path-pruning.md): Why unpublished `exports`/`imports` targets are pruned, how the published file set is computed, and why a missing file causes a warning.
