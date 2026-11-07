// Hybrid Line Numbers: the cursor line shows its number, every other line shows its distance.
// Real released plugin in real Obsidian; only the note text is scripted.
export const clip = { x: 100, y: 70, width: 800, height: 400 };

const NOTE = ['# Method', '', 'First step', 'Second step', 'Third step', 'Fourth step', 'Fifth step', 'Sixth step', 'Seventh step', 'Eighth step', 'Ninth step', 'Tenth step', ''].join('\n');

export default async function (o, r) {
	await r.prep({ left: true });
	await o.open('Method.md', NOTE);
	await o.eval(() => app.workspace.activeEditor.editor.setCursor({ line: 2, ch: 0 }));
	await o.wait(1200);
	r.start();
	await r.hold(1800);
	for (let i = 0; i < 6; i++) await r.press('ArrowDown', 700);
	await r.hold(600);
	for (let i = 0; i < 3; i++) await r.press('ArrowUp', 700);
	await r.hold(1800);
}
