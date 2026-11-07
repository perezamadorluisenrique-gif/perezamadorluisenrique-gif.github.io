#!/usr/bin/env node
// Records a short demo of a plugin running in real Obsidian and writes catalog/video/<slug>.mp4.
//
//   cd obsidian-dev/tools/obsidian-e2e && npm i && bash start.sh owner/repo@tag ...   # releases, no build
//   node catalog/record/record.mjs <slug> [--probe]
//
// A scenario (scenarios/<slug>.mjs) exports `clip` ({x,y,width,height} in CSS px)
// and a default async (o, r) function. `o` is the e2e connection (lib.mjs);
// `r` gives snap(), hold(ms), typeText(text, ms), press(key) and prep(). The UI is
// the real released plugin; only the vault content is scripted, and a scenario
// says so in its header comment when it stubs anything else.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = process.env.E2E_LIB || '/home/user/obsidian-dev/tools/obsidian-e2e/lib.mjs';
const { connect } = await import(pathToFileURL(LIB).href);

const slug = process.argv[2];
const probe = process.argv.includes('--probe');
if (!slug) throw new Error('usage: record.mjs <slug> [--probe]');
const scenario = await import(pathToFileURL(path.join(HERE, 'scenarios', `${slug}.mjs`)).href);

const o = await connect();
await o.eval(() => document.querySelectorAll('style[data-demo]').forEach((e) => e.remove()));
const SCALE = 2;
const clip = { ...scenario.clip, scale: SCALE };
const frames = [];
let last = Date.now();
let recording = false;

const shot = async () => Buffer.from((await o.cdp.send('Page.captureScreenshot', { format: 'png', clip, optimizeForSpeed: true })).data, 'base64');
const r = {
	// A clean window: no sidebars, status bar, inline title or cursor blink; bigger text for readability.
	async reset() {
		await o.eval(() => document.querySelectorAll('style[data-demo]').forEach((e) => e.remove()));
	},
	async prep({ left = true, right = true, status = true, fontSize = 18 } = {}) {
		await o.eval(({ left, right, status, fontSize }) => {
			if (left) app.workspace.leftSplit.collapse();
			if (right) app.workspace.rightSplit.collapse();
			const st = document.createElement('style');
			st.dataset.demo = '1';
			st.textContent = `.cm-cursorLayer{animation:none!important}.notice-container{display:none!important}.inline-title{display:none!important}${status ? '.status-bar{display:none!important}' : ''}body{--font-text-size:${fontSize}px}`;
			document.head.appendChild(st);
		}, { left, right, status, fontSize });
		await o.wait(400);
	},
	async snap(min = 0) {
		if (!recording) return;
		const buf = await shot();
		const now = Date.now();
		frames.push([buf, Math.max(min, now - last)]);
		last = Date.now();
	},
	async hold(ms) {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			await r.snap();
			await o.wait(40);
		}
	},
	async typeText(text, ms = 45) {
		for (const ch of text) {
			await o.page.keyboard.type(ch);
			await o.wait(ms);
			await r.snap();
		}
	},
	async press(key, settle = 120) {
		await o.press(key);
		await o.wait(settle);
		await r.snap();
	},
	start() {
		recording = true;
		last = Date.now();
	},
};

await scenario.default(o, r);
if (probe) {
	fs.writeFileSync(path.join(os.tmpdir(), `probe-${slug}.png`), await shot());
	console.log('probe ->', path.join(os.tmpdir(), `probe-${slug}.png`));
	process.exit(0);
}
if (frames.length < 10) throw new Error(`only ${frames.length} frames; the scenario never called r.start()`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `rec-${slug}-`));
const lines = [];
frames.forEach(([buf, ms], i) => {
	const f = path.join(tmp, `${String(i).padStart(5, '0')}.png`);
	fs.writeFileSync(f, buf);
	lines.push(`file '${f}'`, `duration ${(ms / 1000).toFixed(3)}`);
});
lines.push(`file '${path.join(tmp, String(frames.length - 1).padStart(5, '0') + '.png')}'`);
fs.writeFileSync(path.join(tmp, 'list.txt'), lines.join('\n'));
const outFile = path.join(HERE, '..', 'video', `${slug}.mp4`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const w = Math.round(clip.width * SCALE / 2) * 2;
const h = Math.round(clip.height * SCALE / 2) * 2;
const enc = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', `fps=30,scale=${w}:${h}:flags=lanczos`, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { encoding: 'utf8' });
if (enc.status !== 0) throw new Error(enc.stderr);
fs.rmSync(tmp, { recursive: true, force: true });
const secs = frames.reduce((a, f) => a + f[1], 0) / 1000;
console.log(`${slug}: ${frames.length} frames, ${secs.toFixed(1)} s, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB -> ${outFile}`);
process.exit(0);
