import path from 'path';
import { describe, test, expect } from 'manten';
import spawn from 'nano-spawn';

const cleanPkgJsonPath = path.resolve('./dist/index.mjs');

describe('clean-pkg-roll', () => {
	test('removes unnecessary properties', async () => {
		const { stdout } = await spawn(
			cleanPkgJsonPath,
			['--dry'],
			{
				cwd: './tests/fixture-package',
			},
		);

		expect(JSON.parse(stdout)).toStrictEqual({
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
		const { stdout } = await spawn(
			cleanPkgJsonPath,
			['--dry', '-k', 'eslintConfig,devDependencies'],
			{
				cwd: './tests/fixture-package',
			},
		);

		expect(JSON.parse(stdout)).toStrictEqual({
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
		const { stdout } = await spawn(
			cleanPkgJsonPath,
			['--dry', '-r', 'scripts.postinstall'],
			{
				cwd: './tests/fixture-package',
			},
		);

		expect(JSON.parse(stdout)).toStrictEqual({
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
