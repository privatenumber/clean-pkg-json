import { promises as fs } from 'node:fs';
import { red } from 'ansis';
import { cli } from 'cleye';
import pkg from '../package.json' with { type: 'json' };
import { defaultKeepProperties } from './default-keep-properties.ts';
import { pruneUnpublishedPaths } from './prune-unpublished-paths.ts';

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

const parsePackageJson = (contents: string) => {
	try {
		return JSON.parse(contents);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse ${packageJsonPath}: ${reason}`);
	}
};

const reportError = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`${red('Error:')} ${message}`);
	process.exitCode = 1;
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
	const packageJson = parsePackageJson(packageJsonString);

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

	if (argv.flags.publishedOnly) {
		await pruneUnpublishedPaths(process.cwd(), packageJson, log);
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
})().catch(reportError);
