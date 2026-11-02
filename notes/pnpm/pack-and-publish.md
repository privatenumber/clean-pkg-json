# Pack and publish: when pnpm reads `package.json`

`pnpm pack` reads `package.json` after the `prepack` script, then applies `publishConfig` field overrides to that manifest. So a `prepack` script that rewrites `package.json` decides the packed manifest, and `publishConfig` must still be present after the rewrite for its overrides to apply.

Observed 2026-11-02 with pnpm 12.16.1 on Node.js 26.13.0. The `prepack` script was clean-pkg-json at commit `3ef26b6a5f923765f74d360812a9f1fff44cce1d`, which removes `eslintConfig` and `scripts` and keeps `publishConfig`.

```sh
echo '{"name":"pp","version":"1.0.0","description":"d","publishConfig":{"main":"dist.js"},"main":"src.js","eslintConfig":{},"scripts":{"prepack":"<script>"}}' > package.json
touch src.js dist.js
pnpm pack && tar -xOzf pp-1.0.0.tgz package/package.json
```

Packed `package.json`:

```json
{
    "name": "pp",
    "version": "1.0.0",
    "description": "d",
    "main": "dist.js"
}
```

- `eslintConfig` and `scripts` are absent, so pnpm read the file after `prepack`.
- `main` is `dist.js`, so pnpm applied `publishConfig.main` after `prepack` and removed `publishConfig` from the packed file.

`pnpm publish` was not tested. Its read order is an evidence gap.

## Dry runs are invisible to lifecycle scripts in pnpm 11+

pnpm 11 and later run `prepack` during `pnpm pack --dry-run` and `pnpm publish --dry-run`, but they don't tell the script that it is a dry run. pnpm 10 exported `npm_config_dry_run=true`. pnpm 11.0.0 stopped exporting `npm_config_*` variables to lifecycle scripts on purpose: "Only well-known `npm_*` env vars are now set, matching Yarn's behavior" ([release notes](https://github.com/pnpm/pnpm/releases/tag/v11.0.0), [pnpm/pnpm#11116](https://github.com/pnpm/pnpm/pull/11116)).

Observed 2026-11-02 on Node.js 26.13.0. The `prepack` script printed its environment and then ran clean-pkg-json at commit `9de3922`, which skips the write when `npm_config_dry_run` is `true`.

| Command | `npm_config_dry_run` in `prepack` | `package.json` after the dry run |
| --- | --- | --- |
| `pnpm pack --dry-run`, pnpm 10.34.9 | `true` | unchanged |
| `pnpm pack --dry-run`, pnpm 11.28.10 | not set | rewritten |
| `pnpm pack --dry-run`, pnpm 12.16.1 | not set | rewritten |
| `pnpm publish --dry-run --no-git-checks`, pnpm 12.16.1 | not set | rewritten |

With pnpm 12.16.1, the full `prepack` environment of `pnpm pack --dry-run` and `pnpm pack` was the same. No variable identifies a dry run. The only `pnpm_config_*` variable was `pnpm_config_verify_deps_before_run`.

Requested upstream in [pnpm/pnpm#17563](https://github.com/pnpm/pnpm/issues/17563): set `npm_config_dry_run=true` for lifecycle scripts during dry runs. The maintainer moved it to the Ideas discussion [pnpm#17564](https://github.com/orgs/pnpm/discussions/17564) because the removal in 11.0.0 was deliberate, and was not convinced a change is needed. Reconsider the documented limitation if pnpm ships a dry-run signal.
