// List Item Callouts: start a list item with a character and a space and it becomes a coloured callout.
// Real released plugin in real Obsidian; only the note text is scripted.
export const clip = { x: 150, y: 70, width: 740, height: 360 };

export default async function (o, r) {
	await o.eval(() => app.plugins.disablePlugin('hybrid-line-numbers'));
	await r.prep();
	await o.open('Errands.md', '# Errands\n\n- Pick up the parcel');
	await o.wait(1000);
	r.start();
	await r.hold(1500);
	for (const line of ['& Milk, and the good bread', '[ ] ! Pay the rent before Friday', '? Ask Ana about the tickets', '@ Meet Tom at the station']) {
		await r.press('Enter', 200);
		await r.typeText(line, 40);
		await r.hold(900);
	}
	await r.hold(1800);
}
