// check-manifest.mjs - confirm the manifest fields that decide DSH compatibility.
//
// dsh-app-boot's evaluatePluginCompatibility starts with:
//   if (!Object.hasOwn(fields, "peerDependencies")) return void 0;   // -> compatible
// and then only inspects peers under the "@deepseek-ai/dsh" scope.
// So a bundle with no peerDependencies can never be rejected as incompatible.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const p = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));

const rows = [
	['name', p.name],
	['version', p.version],
	['has peerDependencies', Object.hasOwn(p, 'peerDependencies')],
	['has dependencies', Object.hasOwn(p, 'dependencies')],
	['has repository', p.repository?.url !== undefined],
	['repository', p.repository?.url ?? '(missing)'],
	['dsh.bundle.patch', p.dsh?.bundle?.patch],
	['dsh.hub.displayName', p.dsh?.hub?.displayName],
	['dsh.hub.compatibility.dsh', p.dsh?.hub?.compatibility?.dsh],
	['dsh.hub.entryIds', JSON.stringify(p.dsh?.hub?.entryIds)],
];

for (const [k, v] of rows) console.log(`${k.padEnd(26)} = ${String(v)}`);

// A repository URL that still contains the placeholder cannot be published: the Hub requires
// a real public GitHub repository.
const placeholder = /REPLACE-WITH-YOUR-GITHUB-USERNAME/u.test(p.repository?.url ?? '');
console.log('');
console.log(`repository placeholder      = ${placeholder ? 'STILL PRESENT (must be replaced before npm publish)' : 'no (looks real)'}`);

const compatible = !Object.hasOwn(p, 'peerDependencies');
console.log(`evaluatePluginCompatibility = ${compatible ? 'COMPATIBLE (short-circuits on the first gate)' : 'peerDependencies present - will be range-checked'}`);
process.exit(compatible ? 0 : 1);
