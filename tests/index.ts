import path from 'path';
import { describe, test, expect } from 'manten';
import spawn from 'nano-spawn';
import { createFixture } from 'fs-fixture';

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
};

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
});
