// Inline TOC: a `toc` block lists the note's headings and follows edits as you type.
// Real released plugin in real Obsidian; only the note text is scripted.
export const clip = { x: 150, y: 70, width: 740, height: 440 };

const NOTE = '# Trip notes\n\n```toc\nlevels: 2-3\n```\n\n## Flights\n\nBooked.\n\n## Hotel\n\n### Breakfast\n\nIncluded.\n\n## Packing\n\n';

export default async function (o, r) {
	await r.prep();
	await o.open('Trip notes.md', NOTE);
	await o.wait(1500);
	// Leave the cursor away from the block so it renders as a list.
	r.start();
	await r.hold(2200);
	await r.typeText('## Sights', 90);
	await r.hold(1600);
	await r.press('Enter');
	await r.typeText('### Old town', 90);
	await r.hold(2200);
	await o.eval(() => {
		const ed = app.workspace.activeEditor.editor;
		const v = ed.getValue().replace('## Hotel', '## Where to stay');
		ed.setValue(v);
	});
	await r.hold(2400);
}
