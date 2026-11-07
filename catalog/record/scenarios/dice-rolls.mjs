// Dice Rolls: formulas in a note become results; clicking one rolls again.
// Real released plugin in real Obsidian; only the note text is scripted.
export const clip = { x: 150, y: 70, width: 740, height: 340 };

const NOTE = [
	'# Goblin ambush',
	'',
	'The goblin attacks: `dice: 1d20+4` to hit, `dice: 2d6+2` slashing damage.',
	'',
	'## New character',
	'',
	'Ability scores, drop the lowest: `dice: 4d6dl1` `dice: 4d6dl1` `dice: 4d6dl1` `dice: 4d6dl1`',
	'',
	'Fireball: `dice: 8d6`',
	'',
].join('\n');

export default async function (o, r) {
	await r.prep();
	await o.open('Goblin ambush.md', NOTE);
	await o.eval(() => (app.workspace.activeEditor ?? app.workspace.activeLeaf.view).editor.setCursor({ line: 0, ch: 0 }));
	await o.wait(1200);
	r.start();
	await r.hold(1800);
	const n = await o.eval(() => document.querySelectorAll('.cm-content .dice-rolls-roll').length);
	for (const i of [0, 1, 6 % n, 0, 5 % n]) {
		await o.eval((i) => document.querySelectorAll('.cm-content .dice-rolls-roll')[i]?.click(), i);
		await r.hold(1100);
	}
	await r.hold(1200);
}
