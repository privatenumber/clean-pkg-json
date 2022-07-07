import path from 'path';
import { describe, expect } from 'manten';
import { execaNode } from 'execa';

const cleanPkgJsonPath = path.resolve('./dist/index.js');

describe('clean-pkg-roll', ({ test }) => {
	test('removes unnecessary properties', async () => {
		const { stdout } = await execaNode(
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
		const { stdout } = await execaNode(
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
});
