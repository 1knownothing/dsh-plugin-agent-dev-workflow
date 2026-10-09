// verify.mjs - offline check for the host half of dsh-agent-dev-workflow.
//
// Runs the plugin against a fake Cordis context: no DSH, no profile, no install required.
// Proves that `apply` registers a provider whose summaries and bodies are correct.
//
// Usage: node verify.mjs
// Exit code 0 = pass.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// pathToFileURL, not join: import() rejects a bare Windows path ("D:\...") because it parses
// the drive letter as a URL scheme.
const mod = await import(pathToFileURL(join(here, 'lib', 'index.js')).href);

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
	if (ok) {
		pass += 1;
		console.log(`[PASS] ${label}`);
	} else {
		fail += 1;
		console.log(`[FAIL] ${label}${detail === undefined ? '' : ` -- ${detail}`}`);
	}
}

console.log('=== module contract ===');
check('exports name', typeof mod.name === 'string' && mod.name.length > 0, String(mod.name));
check('injects skills', Array.isArray(mod.inject) && mod.inject.includes('skills'), JSON.stringify(mod.inject));
check('exports apply()', typeof mod.apply === 'function');

console.log('');
console.log('=== apply() registers a provider ===');
let captured;
const ctx = {
	skills: {
		registerProvider(control) {
			captured = control;
		},
	},
};
mod.apply(ctx);
check('registerProvider was called', captured !== undefined);
check('factory returns a provider', typeof captured === 'function');

const provider = captured();
check('provider has a name', typeof provider.name === 'string', String(provider.name));
check('provider.list is a function', typeof provider.list === 'function');
check('provider.get is a function', typeof provider.get === 'function');

console.log('');
console.log('=== list() summary ===');
const list = await provider.list();
check('exactly one candidate', Array.isArray(list) && list.length === 1, JSON.stringify(list?.length));
const candidate = list[0];
check('name is agent-dev-workflow', candidate.name === 'agent-dev-workflow', candidate.name);
check('description is non-empty', typeof candidate.description === 'string' && candidate.description.length > 0);
check('rank is the bundled rank (600)', candidate.rank === 600, String(candidate.rank));
check('model-invocable', candidate.invocation?.modelInvocable === true);
check('user-invocable', candidate.invocation?.userInvocable === true);
check('resourceBase is the assets directory', candidate.resourceBase?.kind === 'directory' && candidate.resourceBase.path.endsWith('assets'), candidate.resourceBase?.path);
check('locator points at SKILL.md', candidate.locator.endsWith('SKILL.md'), candidate.locator);
check('description within the 500-char catalog limit', (candidate.description.replace(/\s+/gu, ' ').trim()).length <= 500, String(candidate.description.replace(/\s+/gu, ' ').trim().length));

console.log('');
console.log('=== get() body ===');
const loaded = await provider.get(candidate, {});
check('body is non-empty', typeof loaded.content === 'string' && loaded.content.length > 0, String(loaded.content?.length));
check('body has no frontmatter', !loaded.content.startsWith('---'), loaded.content.slice(0, 20));
check('body starts with the H1 title', loaded.content.startsWith('# 通用 Agent 开发流程'), loaded.content.slice(0, 30));
check('body mentions all 8 stages', ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].every((s) => loaded.content.includes(s)));
check('provider/locator internals are not leaked to the body', !('rank' in loaded) && !('locator' in loaded));
check('summary fields survive get()', loaded.name === candidate.name && loaded.description === candidate.description);

console.log('');
console.log('=== resource files referenced by the skill exist ===');
const expected = [
	'references/pipeline.md',
	'references/verification.md',
	'references/artifacts.md',
	'references/orchestration.md',
	'references/lessons-ledger.md',
	'assets/templates/spec.md',
	'assets/templates/tasks.md',
	'assets/templates/verify.md',
	'assets/examples/worked-example.md',
	'scripts/install.ps1',
];
const { existsSync } = await import('node:fs');
for (const rel of expected) {
	check(rel, existsSync(join(candidate.resourceBase.path, rel)));
}

console.log('');
console.log('=== failure mode: missing asset must throw at load time ===');
let threw = false;
try {
	mod.apply(ctx, { assetRoot: join(here, 'does-not-exist') });
} catch {
	threw = true;
}
check('apply() throws when assets are missing', threw);

console.log('');
console.log(`RESULT: pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
