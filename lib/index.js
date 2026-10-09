/**
 * @dsh-plugin/agent-dev-workflow - host half.
 *
 * Registers the agent-dev-workflow skill through the DSH skill registry, so the workflow
 * becomes available in every conversation and every project once this bundle is enabled.
 *
 * Design notes (why this file is deliberately boring):
 *
 * - It imports NOTHING from @deepseek-ai/*. Those packages are resolved by the host for the
 *   DSH runtime; a bundle installed under the profile's node_modules cannot rely on resolving
 *   them. The registry API is reached through the injected `ctx`, and the rank constant is
 *   inlined (BUNDLED_SKILL_RANK === 600 in @deepseek-ai/dsh-skill). Having no @deepseek-ai
 *   import also means no peer-version coupling that a DSH upgrade could break.
 * - `ctx.skills.registerProvider(factory)` is called during `apply`, but the factory only
 *   captures the resolved skill directory. Disk reads happen lazily in `get()`, because
 *   Cordis requires a plugin's external effects to stay inside the effect boundaries it owns.
 * - Frontmatter handling mirrors @deepseek-ai/dsh-skill-filesystem: `list()` yields name +
 *   description summaries, `get()` yields the body. The body is the Markdown AFTER the
 *   frontmatter, which is what the skill renderer expects.
 * - `assets/` IS the skill directory (same layout convention as @deepseek-ai/dsh-skill-office):
 *   it holds SKILL.md plus references/, assets/, scripts/.
 */

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Cordis plugin name, used in Loader diagnostics. */
export const name = 'agent-dev-workflow';

/** We contribute to the skill registry, so wait for it to exist. */
export const inject = ['skills'];

/**
 * Rank for a bundle-contributed skill.
 * Matches BUNDLED_SKILL_RANK in @deepseek-ai/dsh-skill: bundled skills rank last, so a
 * project- or user-level skill of the same name still wins.
 */
const BUNDLED_SKILL_RANK = 600;

/** Provider name shown in discovery diagnostics; distinct from the filesystem provider. */
const PROVIDER = 'agent-dev-workflow-bundle';

/** `---\n...\n---` at the very start of the file. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;

/**
 * Parse the `name` and `description` fields out of SKILL.md frontmatter.
 *
 * Intentionally minimal: it reads the two scalar fields the catalog needs and does not
 * implement YAML. A description may be a block scalar (`description: |`), so continuation
 * lines are folded in.
 *
 * @param raw - the whole SKILL.md text.
 * @param path - file path, for error messages.
 * @returns the parsed name and description.
 * @throws when the frontmatter or a required field is missing.
 */
function parseFrontmatter(raw, path) {
	const match = FRONTMATTER.exec(raw);
	if (match?.[1] === undefined) {
		throw new Error(`agent-dev-workflow: ${path} has no YAML frontmatter`);
	}
	const block = match[1];

	const nameMatch = /^name:[ \t]*(\S+)[ \t]*$/mu.exec(block);
	if (nameMatch?.[1] === undefined) {
		throw new Error(`agent-dev-workflow: ${path} has no "name" in its frontmatter`);
	}

	// `description:` may be inline or a block scalar whose lines follow, more indented.
	const lines = block.split(/\r?\n/u);
	const start = lines.findIndex((line) => /^description:[ \t]*/u.test(line));
	if (start === -1) {
		throw new Error(`agent-dev-workflow: ${path} has no "description" in its frontmatter`);
	}
	const inline = lines[start].replace(/^description:[ \t]*/u, '').trim();
	let description = inline === '|' || inline === '>' || inline === '|-' || inline === '>-' ? '' : inline;
	if (description === '') {
		const parts = [];
		for (let i = start + 1; i < lines.length; i += 1) {
			const line = lines[i];
			if (line.trim() === '') {
				parts.push('');
				continue;
			}
			if (!/^[ \t]/u.test(line)) break;
			parts.push(line.trim());
		}
		description = parts.join(' ').trim();
	}
	if (description === '') {
		throw new Error(`agent-dev-workflow: ${path} has an empty description`);
	}

	return { name: nameMatch[1], description };
}

/**
 * Register the skill provider.
 * @param ctx - Cordis context carrying the skill registry.
 * @param config - bundle config from cordis.patch.yml.
 * @param config.assetRoot - absolute override for the assets directory (packaged apps).
 */
export function apply(ctx, config = {}) {
	// assets/ is the skill directory itself (SKILL.md + references/ + assets/ + scripts/).
	const skillDirectory = (config.assetRoot ?? fileURLToPath(new URL('../assets/', import.meta.url))).replace(/[\\/]+$/u, '');
	const skillPath = `${skillDirectory}/SKILL.md`;

	// Read once, now: a bundle whose own assets are missing or malformed should fail loudly at
	// load time rather than vanish from the catalog with only a warning later.
	const parsed = parseFrontmatter(readFileSync(skillPath, 'utf8'), skillPath);

	const candidate = {
		name: parsed.name,
		description: parsed.description,
		invocation: { modelInvocable: true, userInvocable: true },
		provider: PROVIDER,
		source: 'bundled',
		rank: BUNDLED_SKILL_RANK,
		resourceBase: { kind: 'directory', path: skillDirectory },
		locator: skillPath,
	};

	const provider = {
		name: PROVIDER,
		list: () => Promise.resolve([candidate]),
		get: async (selected, options) => {
			const raw = await readFile(selected.locator, { encoding: 'utf8', signal: options.signal });
			const { rank: _rank, locator: _locator, ...summary } = selected;
			return { ...summary, content: raw.slice(FRONTMATTER.exec(raw)[0].length).trim() };
		},
	};

	ctx.skills.registerProvider(() => provider);
}
