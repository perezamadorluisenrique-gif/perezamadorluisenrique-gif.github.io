// Emoji Search: type :shortcode, pick from suggestions, then the full picker.
// Real released plugin in real Obsidian; only the note text is scripted.
export const clip = { x: 150, y: 70, width: 740, height: 400 };

export default async function (o, r) {
	await r.prep();
	await o.open('Party plan.md', '# Party plan\n\nSaturday is on. Cake ordered, playlist ready, ');
	await o.wait(900);
	r.start();
	await r.hold(1200);
	await r.typeText(':tad', 140);
	await r.hold(1500);
	await r.press('Enter');
	await r.hold(900);
	await r.typeText(' and the best view: :roc', 120);
	await r.hold(1400);
	await r.press('Enter');
	await r.hold(1400);
	await o.eval(() => app.commands.executeCommandById('emoji-search:insert-emoji'));
	await r.hold(1200);
	await r.typeText('cake', 150);
	await r.hold(1500);
	await r.press('Enter');
	await r.hold(1800);
}
