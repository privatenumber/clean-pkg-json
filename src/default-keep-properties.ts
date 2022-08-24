export const defaultKeepProperties = [
	// Required fields
	'name',
	'version',

	// Read by npm
	'private',
	'publishConfig',
	'type',

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
	'module',
	'types',
	'exports',
	'imports',
	'man',

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
	
	// bundler spec
	'sideEffects',
];
