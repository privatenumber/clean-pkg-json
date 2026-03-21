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

(async () => {
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

	const fieldsToPrune = ['imports', 'exports'].filter(field => packageJson[field]);
	if (fieldsToPrune.length > 0) {
		const publishedFiles = await getPublishedFiles(process.cwd(), packageJson);
		for (const field of fieldsToPrune) {
			const pruned = pruneUnpublishedPaths(packageJson[field], publishedFiles);
			if (pruned === null) {
				log(`Removing property "${field}" (all paths unpublished)`);
				delete packageJson[field];
			} else {
				packageJson[field] = pruned;
			}
		}
	}

	const newPackageJsonString = JSON.stringify(packageJson, null, 2);
	if (argv.flags.dry || argv.flags.verbose) {
		console.log(newPackageJsonString);
	}

	if (!argv.flags.dry) {
		await fs.writeFile(
			packageJsonPath,
			newPackageJsonString,
		);
		log(`Updated ${packageJsonPath}`);
	}
})();
