# Engineering research notes

Tracked maintainer references for the research and decisions that shape clean-pkg-json. The `notes/` directory is not in the `files` list in `package.json`, so it is not published.

## Ownership

The upstream behavior that clean-pkg-json depends on (npm, pnpm, Node.js, TypeScript, bundlers, CDNs, and editors) is cited inline, beside the project decision that depends on it. The `clean-pkg-json/` folder owns project policy, the property allowlist, and how the tool fits into the publish lifecycle.

## Index

| Folder | Owns |
| --- | --- |
| [clean-pkg-json/](./clean-pkg-json/README.md) | Property vetting, publish lifecycle integration, and `exports`/`imports` pruning |

## Evidence

Cite upstream facts beside the claim. Use primary sources, preferably pinned releases or commits. Ground project behavior in repository source or tests, and label decisions with their rationale. Distinguish documented and observed behavior from inference. Keep executable contracts in the test suite (`tests/index.ts`).

## Maintenance

When upstream evidence changes, update the notes and identify the affected project decisions and tests. Re-run the recorded experiments against the new versions before you reuse a claim.
