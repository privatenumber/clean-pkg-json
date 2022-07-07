export const defaultKeepProperties = [
	// Required fields
	'name',
	'version',

	// Read by npm
	'private',
	'publishConfig',
	'type',

	// Install hooks
	'scripts.preinstall',
	'scripts.install',
	'scripts.postinstall',
	'scripts.prepublish',
	'scripts.preprepare',
	'scripts.prepare',
	'scripts.postprepare',

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
];
