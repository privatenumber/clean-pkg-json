# Engineering research notes

Tracked maintainer references for the research and decisions that shape clean-pkg-json. The `notes/` directory is not in the `files` list in `package.json`, so it is not published.

## Ownership

Each upstream folder owns that tool's behavior, version boundaries, and the experiments that observed it. The `clean-pkg-json/` folder owns project policy, the property allowlist, and how the tool fits into the publish lifecycle, and it links to the upstream evidence. Single-source upstream facts, such as one bundler's default main fields, are cited inline in the project note instead of getting their own folder.

## Index

| Folder | Owns |
| --- | --- |
| [npm/](./npm/README.md) | When `npm pack` and `npm publish` read `package.json`, and the fields npm reads from an installed dependency |
| [pnpm/](./pnpm/README.md) | When `pnpm pack` reads `package.json` and applies `publishConfig` |
| [nodejs/](./nodejs/README.md) | The `package.json` fields Node.js defines, custom conditions, and subpath patterns |
| [typescript/](./typescript/README.md) | The `package.json` fields TypeScript reads, including the TypeScript 7.1 content mapper manifest |
| [angular/](./angular/README.md) | Angular Package Format legacy resolution keys by version |
| [clean-pkg-json/](./clean-pkg-json/README.md) | Property vetting, publish lifecycle integration, and `exports`/`imports` pruning |

## Evidence

Cite upstream facts beside the claim. Use primary sources, preferably pinned releases or commits. Ground project behavior in repository source or tests, and label decisions with their rationale. Distinguish documented and observed behavior from inference. Keep executable contracts in the test suite (`tests/index.ts`).

## Maintenance

When upstream evidence changes, update the owner's note, then the project decisions and tests that link to it. Re-run the recorded experiments against the new versions before you reuse a claim.
