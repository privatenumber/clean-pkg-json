export const defaultKeepProperties = [
	// Required fields
	'name',
	'version',

	// Publishing
	'private',
	'publishConfig',

	// Install hooks
	// npm 6 & 7
	'scripts.preinstall',
	'scripts.install',
	'scripts.postinstall',

	// npm 8
	'scripts.dependencies',

	// Files
	'files',
	'bin',
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
	'bundledDependencies',
	'optionalDependencies',

	// Env dependencies
	'engines',
	'os',
	'cpu',

	// Read by npmjs.com
	'description',
	'keywords',
	'author',
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
	'sponsor',
	'extensionPack',
	'extensionDependencies',
	'extensionKind',
	'icon',

	// Angular - https://angular.io/guide/angular-package-format#legacy-resolution-keys
	'fesm2020',
	'fesm2015',
	'esm2020',
	'es2020',

	// TypeScript
	'types',
	'typings',
	'typesVersions',

	// bundler spec
	'module', // https://stackoverflow.com/questions/42708484/what-is-the-module-package-json-field-for
	'sideEffects', // https://webpack.js.org/configuration/optimization/#optimizationsideeffects
];
