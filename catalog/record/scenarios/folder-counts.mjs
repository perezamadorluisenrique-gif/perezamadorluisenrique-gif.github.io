// Folder Counts: a note count next to every folder in the file explorer, live as notes come and go.
// Real released plugin in real Obsidian; only the vault content is scripted.
export const clip = { x: 0, y: 40, width: 350, height: 380 };

export default async function (o, r) {
	await o.eval(async () => {
		for (const f of app.vault.getRoot().children.filter((c) => c.name !== 'Welcome.md')) await app.vault.trash(f, true);
		const mk = async (p) => {
			const dir = p.split('/').slice(0, -1);
			for (let i = 1; i <= dir.length; i++) { const d = dir.slice(0, i).join('/'); if (!app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d); }
			if (!app.vault.getAbstractFileByPath(p)) await app.vault.create(p, '# ' + p);
		};
		for (const n of ['Ideas/Newsletter', 'Ideas/Podcast', 'Ideas/Book', 'Projects/Website/Plan', 'Projects/Website/Copy', 'Projects/Garden', 'Reading/Notes', 'Reading/Highlights/One', 'Reading/Highlights/Two'])
			await mk(n + '.md');
		app.workspace.leftSplit.expand();
		app.workspace.rightSplit.collapse();
		const st = document.createElement('style');
		st.dataset.demo = '1';
		st.textContent = '.notice-container{display:none!important}.status-bar{display:none!important}';
		document.head.appendChild(st);
		app.workspace.getLeavesOfType('file-explorer')[0]?.view?.containerEl?.focus();
	});
	await o.wait(1800);
	r.start();
	await r.hold(2400);
	await o.eval(async () => {
		await app.vault.create('Projects/Website/Launch.md', '# Launch');
		await app.vault.create('Projects/Website/Pricing.md', '# Pricing');
	});
	await r.hold(2400);
	await o.eval(async () => { await app.vault.trash(app.vault.getAbstractFileByPath('Ideas/Book.md'), true); });
	await r.hold(2400);
	await o.eval(() => { const v = app.workspace.getLeavesOfType('file-explorer')[0].view; v.fileItems['Reading'].selfEl.click(); });
	await r.hold(2200);
}
