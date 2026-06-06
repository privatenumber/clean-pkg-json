import path from 'path';
import { promises as nodeFs } from 'node:fs';
import { describe, test, expect } from 'manten';
import spawn from 'nano-spawn';
import { createFixture } from 'fs-fixture';
import type { PackageJson } from 'type-fest';
import { pruneUnpublishedPaths } from '../src/prune-unpublished-paths.ts';
import { createPathMatcher, pathMatches } from '../src/path-matcher.ts';

const cleanPkgJsonPath = path.resolve('./src/index.ts');

const cleanPkgJson = (
	cwd: string,
	flags: string[] = [],
) => spawn(
	process.execPath,
	[cleanPkgJsonPath, ...flags],
	{ cwd },
);

const fixturePackageJson = {
	name: 'test-package',
	version: '1.0.0',
	description: 'Test fixture',
	license: 'MIT',
	scripts: {
		postinstall: 'echo postinstall',
		test: 'echo test',
	},
	dependencies: {
		lodash: '*',
	},
	devDependencies: {
		webpack: '*',
	},
	eslintConfig: {
		extends: '@pvtnbr',
	},
} satisfies PackageJson;

describe('clean-pkg-json', () => {
	test('removes unnecessary properties', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify(fixturePackageJson),
		});

		await cleanPkgJson(fixture.path);

		expect(await fixture.readJson('package.json')).toStrictEqual({
			name: 'test-package',
			version: '1.0.0',
			description: 'Test fixture',
			license: 'MIT',
			scripts: {
				postinstall: 'echo postinstall',
			},
			dependencies: {
				lodash: '*',
			},
		});
	});

	test('keep flag', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify(fixturePackageJson),
		});

		await cleanPkgJson(fixture.path, ['-k', 'eslintConfig,devDependencies']);

		expect(await fixture.readJson('package.json')).toStrictEqual({
			name: 'test-package',
			version: '1.0.0',
			description: 'Test fixture',
			license: 'MIT',
			scripts: {
				postinstall: 'echo postinstall',
			},
			dependencies: {
				lodash: '*',
			},
			devDependencies: {
				webpack: '*',
			},
			eslintConfig: {
				extends: '@pvtnbr',
			},
		});
	});

	test('remove flag', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify(fixturePackageJson),
		});

		await cleanPkgJson(fixture.path, ['-r', 'scripts.postinstall']);

		expect(await fixture.readJson('package.json')).toStrictEqual({
			name: 'test-package',
			version: '1.0.0',
			description: 'Test fixture',
			license: 'MIT',
			dependencies: {
				lodash: '*',
			},
		});
	});

	test('remove top-level default property', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify(fixturePackageJson),
		});

		await cleanPkgJson(fixture.path, ['-r', 'dependencies']);

		const result = await fixture.readJson('package.json');
		expect(result).not.toHaveProperty('dependencies');
		expect(result).toHaveProperty('name', 'test-package');
	});

	test('keep scripts preserves all scripts', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify(fixturePackageJson),
		});

		await cleanPkgJson(fixture.path, ['-k', 'scripts']);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.scripts).toStrictEqual({
			postinstall: 'echo postinstall',
			test: 'echo test',
		});
	});

	test('dry run prints without writing', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify(fixturePackageJson),
		});

		const { stdout } = await cleanPkgJson(fixture.path, ['--dry']);

		// stdout contains cleaned JSON
		const printed = JSON.parse(stdout);
		expect(printed).not.toHaveProperty('devDependencies');

		// file on disk is unchanged
		const onDisk = await fixture.readJson('package.json');
		expect(onDisk).toHaveProperty('devDependencies');
	});

	test('error on missing package.json', async () => {
		await using fixture = await createFixture({});

		await expect(cleanPkgJson(fixture.path)).rejects.toThrow();
	});
});

describe('prune unpublished paths', () => {
	test('prunes import entry pointing to unpublished file', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				imports: {
					'#utils': './src/utils.ts',
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result).not.toHaveProperty('imports');
	});

	test('preserves import entry pointing to published file', async () => {
		await using fixture = await createFixture({
			'dist/utils.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				imports: {
					'#utils': './dist/utils.js',
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.imports).toStrictEqual({
			'#utils': './dist/utils.js',
		});
	});

	test('conditional import — prunes only unpublished branches', async () => {
		await using fixture = await createFixture({
			'dist/config.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				imports: {
					'#config': {
						development: './src/config.dev.ts',
						default: './dist/config.js',
					},
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.imports).toStrictEqual({
			'#config': {
				default: './dist/config.js',
			},
		});
	});

	test('conditional import — removes entry when all branches unpublished', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				imports: {
					'#internal': {
						development: './src/internal.dev.ts',
						default: './src/internal.ts',
					},
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result).not.toHaveProperty('imports');
	});

	test('exports — prunes unpublished branches', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': {
						source: './src/index.ts',
						default: './dist/index.js',
					},
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'.': {
				default: './dist/index.js',
			},
		});
	});

	test('bare string export — prunes if unpublished', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: './src/index.ts',
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result).not.toHaveProperty('exports');
	});

	test('null values preserved (used to block subpaths)', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': './dist/index.js',
					'./internal/*': null,
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'.': './dist/index.js',
			'./internal/*': null,
		});
	});

	test('fallback arrays — prunes unpublished entries', async () => {
		await using fixture = await createFixture({
			'dist/index.mjs': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': [
						{ import: './dist/index.mjs' },
						'./src/index.js',
					],
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'.': [
				{ import: './dist/index.mjs' },
			],
		});
	});

	test('wildcard patterns — preserved when matching files exist', async () => {
		await using fixture = await createFixture({
			'dist/utils/format.js': '',
			'dist/utils/parse.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'./utils/*': './dist/utils/*.js',
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'./utils/*': './dist/utils/*.js',
		});
	});

	test('wildcard patterns — pruned and warns when no matching files exist', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': './dist/index.js',
					'./utils/*': './src/utils/*.ts',
				},
			}),
		});

		const { stderr } = await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'.': './dist/index.js',
		});
		expect(stderr).toContain('./src/utils/*.ts');
	});

	test('wildcard patterns — pruned silently when matching files exist but are excluded', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'src/utils/format.ts': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': './dist/index.js',
					'./utils/*': './src/utils/*.ts',
				},
			}),
		});

		const { stderr } = await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'.': './dist/index.js',
		});
		expect(stderr).not.toContain("don't exist");
	});

	test('--published-only=false disables path pruning', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				imports: {
					'#utils': './src/utils.ts',
				},
			}),
		});

		await cleanPkgJson(fixture.path, ['--published-only=false']);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.imports).toStrictEqual({
			'#utils': './src/utils.ts',
		});
	});

	test('non-path specifiers left untouched', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				imports: {
					'#dep': 'lodash',
					'#local': './dist/index.js',
				},
			}),
		});

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.imports).toStrictEqual({
			'#dep': 'lodash',
			'#local': './dist/index.js',
		});
	});

	test('warns when an entry is removed because its file does not exist', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': './dist/index.js',
					'./sub': './not-built.js',
				},
			}),
		});

		const { stderr } = await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({ '.': './dist/index.js' });
		expect(stderr).toContain('./not-built.js');
	});

	test('does not warn when removing an excluded file that exists on disk', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'src/index.ts': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': {
						source: './src/index.ts',
						default: './dist/index.js',
					},
				},
			}),
		});

		const { stderr } = await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({ '.': { default: './dist/index.js' } });
		expect(stderr).not.toContain("don't exist");
	});

	test('only reads the referenced directory for wildcards, not the whole tree', async () => {
		await using fixture = await createFixture({
			'dist/index.js': '',
			'unrelated/deep/file.js': '',
			'package.json': JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
				files: ['dist'],
				exports: {
					'.': './dist/index.js',
					'./utils/*': './src/utils/*.ts',
				},
			}),
		});

		const readDirectories: string[] = [];
		const spyFs = {
			stat: nodeFs.stat,
			readdir: ((directory: string, options: unknown) => {
				readDirectories.push(directory.split(path.sep).join('/'));
				return nodeFs.readdir(directory as string, options as never);
			}) as typeof nodeFs.readdir,
		};

		const packageJson = await fixture.readJson<Record<string, unknown>>('package.json');
		await pruneUnpublishedPaths(fixture.path, packageJson, () => {}, spyFs);

		// The only pruned specifier is the wildcard './src/utils/*.ts',
		// so we must scan its directory (src/utils) and nothing else.
		const root = fixture.path.split(path.sep).join('/');
		expect(readDirectories).not.toContain(root);
		expect(readDirectories.some(directory => directory.endsWith('/unrelated'))).toBe(false);
		expect(readDirectories.some(directory => directory.endsWith('/src/utils'))).toBe(true);
		expect(packageJson.exports).toStrictEqual({ '.': './dist/index.js' });
	});
});

describe('path matcher', () => {
	// Whether a file path is a possible expansion of a `*` target pattern,
	// per Node's exports/imports resolution: every `*` is replaced by the same
	// captured value (which may contain `/`).
	// https://nodejs.org/api/packages.html#subpath-patterns
	const matches = (
		pattern: string,
		filePath: string,
	) => pathMatches(createPathMatcher(pattern), filePath);

	test('single star matches by prefix and suffix', () => {
		expect(matches('dist/*.js', 'dist/index.js')).toBe(true);
		expect(matches('dist/*.js', 'dist/index.mjs')).toBe(false);
		expect(matches('dist/*.js', 'src/index.js')).toBe(false);
	});

	test('star spans path separators', () => {
		// Node: "All instances of * ... replaced ... including if it contains
		// any / separators."
		expect(matches('features/*', 'features/x')).toBe(true);
		expect(matches('features/*', 'features/y/y')).toBe(true);
		expect(matches('dist/*.js', 'dist/nested/file.js')).toBe(true);
	});

	test('star may capture an empty value', () => {
		expect(matches('dist/*.js', 'dist/.js')).toBe(true);
	});

	test('does not match when prefix and suffix would overlap', () => {
		// `aaa*aaa` needs at least 6 chars; the captured value can't be negative.
		expect(matches('aaa*aaa', 'aaaXaaa')).toBe(true);
		expect(matches('aaa*aaa', 'aaaaa')).toBe(false);
	});

	test('repeated stars must resolve to the same value', () => {
		expect(matches('dist/*-*.js', 'dist/a-a.js')).toBe(true);
		expect(matches('dist/*-*.js', 'dist/a-b.js')).toBe(false);
		expect(matches('locale/*/*.js', 'locale/en/en.js')).toBe(true);
		expect(matches('locale/*/*.js', 'locale/en/fr.js')).toBe(false);
	});

	test('repeated stars match when the captured value contains the separator', () => {
		// `*-*` with capture `foo-bar` expands to `foo-bar-foo-bar`.
		expect(matches('dist/*-*.js', 'dist/foo-bar-foo-bar.js')).toBe(true);
		expect(matches('dist/*-*.js', 'dist/foo-bar.js')).toBe(false);
	});
});
