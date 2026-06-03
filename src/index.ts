import { promises as fs } from 'node:fs';
import { cli } from 'cleye';
import pkg from '../package.json' with { type: 'json' };
import { defaultKeepProperties } from './default-keep-properties.ts';
import { getPublishedFiles, pruneUnpublishedPaths } from './prune-unpublished-paths.ts';

const { name, version, description } = pkg;

const packageJsonPath = './package.json';

const argv = cli({
	name,
	version,
	flags: {
		verbose: {
			type: Boolean,
			alias: 'v',
			description: 'Log changes',
		},
		keep: {
			type: [String],
			alias: 'k',
			description: 'package.json properties to keep',
		},
		remove: {
			type: [String],
			alias: 'r',
			description: 'package.json properties to remove',
		},
		dry: {
			type: Boolean,
			alias: 'd',
			description: 'Dry run',
		},
		publishedOnly: {
			type: Boolean,
			description: 'Prune unpublished paths from exports/imports',
			default: true,
		},
	},
	help: {
		description,
	},
});

const log = (...args: any[]) => {
	if (argv.flags.verbose) {
		console.log(...args);
	}
};

const pruneUnpublishedFields = async (
	packageJson: Record<string, unknown>,
	fields: string[],
) => {
	const cwd = process.cwd();
	const publishedFiles = await getPublishedFiles(cwd, packageJson);
	const missingFiles = new Set<string>();

	for (const field of fields) {
		const { result, removedMissingFiles } = pruneUnpublishedPaths(
			packageJson[field],
			publishedFiles,
			cwd,
		);
		for (const file of removedMissingFiles) {
			missingFiles.add(file);
		}

		if (result === undefined) {
			log(`Removing property "${field}" (no published files referenced)`);
			delete packageJson[field];
		} else {
			packageJson[field] = result;
		}
	}

	if (missingFiles.size > 0) {
		console.warn(
			'clean-pkg-json: removed exports/imports entries pointing to files that '
			+ `don't exist: ${Array.from(missingFiles).join(', ')}\n`
			+ 'If these are build outputs, run clean-pkg-json after building.',
		);
	}
};

(async () => {
	const isDryRun = argv.flags.dry || process.env.npm_config_dry_run === 'true';

	const packageJsonExists = await fs.access(packageJsonPath).then(
		() => true,
		() => false,
	);

	if (!packageJsonExists) {
		throw new Error(`${packageJsonPath} does not exist`);
	}

	const packageJsonString = await fs.readFile(packageJsonPath, 'utf8');
	const packageJson = JSON.parse(packageJsonString);

	const keepProperties = new Set([
		...defaultKeepProperties,
		...argv.flags.keep.flatMap(keepProperty => keepProperty.split(',')),
	]);

	for (const item of argv.flags.remove) {
		keepProperties.delete(item);
	}

	log('Keeping properties', Array.from(keepProperties));

	for (const property in packageJson) {
		if (keepProperties.has(property)) {
			continue;
		}

		if (property === 'scripts') {
			for (const script in packageJson.scripts) {
				if (keepProperties.has(`${property}.${script}`)) {
					continue;
				}

				delete packageJson.scripts[script];
			}

			if (Object.keys(packageJson.scripts).length > 0) {
				continue;
			}
		}

		log(`Removing property "${property}"`);
		delete packageJson[property];
	}

	const fieldsToPrune = argv.flags.publishedOnly
		? ['imports', 'exports'].filter(field => packageJson[field])
		: [];
	if (fieldsToPrune.length > 0) {
		await pruneUnpublishedFields(packageJson, fieldsToPrune);
	}

	const newPackageJsonString = JSON.stringify(packageJson, null, 2);
	if (isDryRun || argv.flags.verbose) {
		console.log(newPackageJsonString);
	}

	if (!isDryRun) {
		await fs.writeFile(
			packageJsonPath,
			newPackageJsonString,
		);
		log(`Updated ${packageJsonPath}`);
	}
})();
