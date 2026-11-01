// Each entry needs a vetted consumer: notes/clean-pkg-json/property-vetting.md
export const defaultKeepProperties = [
	// Required fields
	'name',
	'version',

	// Publishing
	'private',
	'publishConfig',

	// Install hooks
	'scripts.preinstall',
	'scripts.install',
	'scripts.postinstall',

	// `false` stops npm from running `node-gyp rebuild` when binding.gyp exists
	'gypfile',

	// Read by prebuild-install and node-pre-gyp in install scripts
	'binary',

	// Files
	'files',
	'bin',
	'directories',
	'browser',
	'main',
	'man',

	// CDN
	'jsdelivr',
	'unpkg',

	// Dependencies
	'dependencies',
	'peerDependencies',
	'peerDependenciesMeta',
	'bundleDependencies',
	'bundledDependencies',
	'optionalDependencies',

	// Env dependencies
	'engines',
	'os',
	'cpu',
	'libc',

	// Read by npmjs.com
	'description',
	'keywords',
	'author',
	'maintainers',
	'contributors',
	'license',
	'homepage',
	'repository',
	'bugs',
	'funding',

	// Node.js
	'type',
	'exports',
	'imports',

	// VSCode - https://code.visualstudio.com/api/references/extension-manifest
	'sponsor',
	'publisher',
	'displayName',
	'categories',
	'galleryBanner',
	'preview',
	'contributes',
	'activationEvents',
	'badges',
	'markdown',
	'qna',
	'extensionPack',
	'extensionDependencies',
	'extensionKind',
	'icon',

	// Angular - https://angular.dev/tools/libraries/angular-package-format
	'fesm2020',
	'fesm2015',
	'esm2020',
	'es2020',

	// TypeScript
	'types',
	'typings',
	'typesVersions',

	// TypeScript 7.1+ content mapper manifest (typescript.contentMapper)
	'typescript',

	// bundler spec
	'module', // https://stackoverflow.com/questions/42708484/what-is-the-module-package-json-field-for
	'sideEffects', // https://webpack.js.org/configuration/optimization/#optimizationsideeffects
];
