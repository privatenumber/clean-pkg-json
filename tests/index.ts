import path from 'path';
import { describe, test, expect } from 'manten';
import spawn from 'nano-spawn';
import { createFixture } from 'fs-fixture';
import type { PackageJson } from 'type-fest';

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

	test('wildcard patterns — pruned when no matching files exist', async () => {
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

		await cleanPkgJson(fixture.path);

		const result = await fixture.readJson<PackageJson>('package.json');
		expect(result.exports).toStrictEqual({
			'.': './dist/index.js',
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
});
