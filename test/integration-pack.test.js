import assert from 'node:assert/strict';
import { promises as fsPromises } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(__dirname, 'fixtures', 'SAMPLE.ARW');

function runCommand(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			error.stdout = stdout;
			error.stderr = stderr;
			reject(error);
		});

		child.on('close', (code) => {
			if (code !== 0) {
				const error = new Error(`Command failed: ${command} ${args.join(' ')}`);
				error.stdout = stdout;
				error.stderr = stderr;
				reject(error);
				return;
			}

			resolve({ stdout, stderr });
		});
	});
}

async function ensureFixture() {
	const fixtureStat = await fsPromises.stat(fixturePath).catch(() => null);
	if (fixtureStat && fixtureStat.size > 0) {
		return;
	}
	await runCommand('node', ['test/download-fixture.js'], repoRoot);
}

async function findPackedTarball() {
	const entries = await fsPromises.readdir(repoRoot);
	const tgzCandidates = entries.filter((name) => name.startsWith('dcraw-wasm-') && name.endsWith('.tgz'));
	assert.ok(tgzCandidates.length > 0, 'Expected npm pack to produce a dcraw-wasm-*.tgz file');

	const sorted = tgzCandidates.sort();
	return path.join(repoRoot, sorted[sorted.length - 1]);
}

async function main() {
	await ensureFixture();

	await runCommand('npm', ['run', 'build:prod'], repoRoot);
	await runCommand('npm', ['pack'], repoRoot);

	const tarballPath = await findPackedTarball();
	const sandboxDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'dcraw-wasm-pack-test-'));

	try {
		await runCommand('npm', ['init', '-y'], sandboxDir);
		await runCommand('npm', ['install', tarballPath], sandboxDir);

		const packageRoot = path.join(sandboxDir, 'node_modules', 'dcraw-wasm');
		const moduleUrl = pathToFileURL(path.join(packageRoot, 'dist', 'index.js')).href;
		const internalModuleUrl = pathToFileURL(path.join(packageRoot, 'src', 'dcraw-wasm.js')).href;
		const { RawDecoder } = await import(moduleUrl);
		const { DcrawWasm } = await import(internalModuleUrl);

		const fixture = await fsPromises.readFile(fixturePath);
		const rawBuffer = new Uint8Array(fixture);

		const rawDecoder = new RawDecoder();
		await rawDecoder.init({
			locateFile: (wasmFileName) => path.join(packageRoot, 'bin', wasmFileName),
		});
		const metadataResult = rawDecoder.readMetadata(rawBuffer);
		assert.equal(typeof metadataResult.rawText, 'string');
		assert.ok(metadataResult.rawText.trim().length > 0, 'Expected typed metadata output from packed module');

		const dcraw = new DcrawWasm();
		await dcraw.init({
			locateFile: (wasmFileName) => path.join(packageRoot, 'bin', wasmFileName),
		});
		const metadata = dcraw.run(rawBuffer, { identify: true, verbose: true });
		assert.equal(typeof metadata, 'string');
		assert.ok(metadata.trim().length > 0, 'Expected internal metadata output from packed module');

		console.log('Pack integration test passed.');
	} finally {
		await fsPromises.rm(sandboxDir, { recursive: true, force: true });
		await fsPromises.rm(tarballPath, { force: true });
	}
}

main().catch((error) => {
	console.error('Pack integration test failed.');
	if (error.stdout) {
		console.error(error.stdout);
	}
	if (error.stderr) {
		console.error(error.stderr);
	}
	console.error(error);
	process.exit(1);
});
