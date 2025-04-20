import path from 'path';
import { describe, expect } from 'manten';
import spawn from 'nano-spawn';

const cleanPkgJsonPath = path.resolve('./dist/index.js');

describe('clean-pkg-roll', ({ test }) => {
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
			dependencies: {
				lodash: '*',
			},
		});
	});
});
