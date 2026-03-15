import assert from 'node:assert/strict';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RawDecoder } from '../dist/index.js';
import { analyzeNodeFiles } from '../dist/node.js';
import { DcrawWasm } from '../src/dcraw-wasm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, 'fixtures', 'SAMPLE.ARW');

let rawBuffer;

before(async () => {
	const fixture = await fsPromises.readFile(fixturePath);
	rawBuffer = new Uint8Array(fixture);
});

test('extracts typed metadata through RawDecoder', async () => {
	const rawDecoder = new RawDecoder();
	await rawDecoder.init();
	const metadata = rawDecoder.readMetadata(rawBuffer);
	assert.equal(typeof metadata.rawText, 'string');
	assert.ok(metadata.rawText.trim().length > 0, 'Expected metadata output to be non-empty');
	assert.ok(metadata.properties.length > 0, 'Expected parsed metadata properties');

	const camera = metadata.propertyMap['camera.model'];
	assert.ok(camera, 'Expected camera.model property to be present');
});

test('extracts embedded thumbnail bytes through RawDecoder', async () => {
	const rawDecoder = new RawDecoder();
	await rawDecoder.init();
	const output = rawDecoder.extractThumbnail(rawBuffer);
	assert.ok(output instanceof Uint8Array, 'Expected thumbnail output as Uint8Array');
	assert.ok(output.length > 0, 'Expected thumbnail output to be non-empty');
});

test('analyzeNodeFiles extracts metadata and thumbnail in one high-level call', async () => {
	const summary = await analyzeNodeFiles([fixturePath], {
		includeMetadata: true,
		includeThumbnail: true,
	});

	assert.equal(summary.failed, 0);
	assert.equal(summary.succeeded, 1);
	assert.ok(summary.results[0].metadata, 'Expected metadata to be present');
	assert.ok(summary.results[0].thumbnail instanceof Uint8Array, 'Expected thumbnail bytes to be present');
	assert.ok(summary.results[0].thumbnail.length > 0, 'Expected thumbnail output to be non-empty');
});

test('internal low-level class still works', async () => {
	const internalDcrawWasm = new DcrawWasm();
	await internalDcrawWasm.init();
	const output = internalDcrawWasm.run(rawBuffer, { identify: true, verbose: true });
	assert.equal(typeof output, 'string');
	assert.ok(output.trim().length > 0, 'Expected internal metadata output to be non-empty');
});

test('readMetadataSafe returns a friendly error for missing input', async () => {
	const rawDecoder = new RawDecoder();
	await rawDecoder.init();
	const output = rawDecoder.readMetadataSafe(undefined);

	assert.equal(output.ok, false);
	assert.equal(output.data, null);
	assert.equal(typeof output.error, 'string');
	assert.ok(output.error.length > 0, 'Expected a non-empty error message');
});
