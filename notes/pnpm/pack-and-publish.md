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
