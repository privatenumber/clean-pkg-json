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
