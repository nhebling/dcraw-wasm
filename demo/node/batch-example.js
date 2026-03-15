import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeNodeFiles } from '../../dist/node.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const fixturePath = path.join(repoRoot, 'test', 'fixtures', 'SAMPLE.ARW');
const outputDir = path.join(repoRoot, 'demo', 'node', 'output');

const summary = await analyzeNodeFiles([fixturePath], {
	includeMetadata: true,
	includeThumbnail: true,
	concurrency: 1,
	thumbnailOutputDir: outputDir,
	onProgress: (event) => {
		console.log(`[${event.status}] ${event.filePath}`);
	},
});

console.log('\nBatch summary:');
console.log(`Total: ${summary.total}`);
console.log(`Succeeded: ${summary.succeeded}`);
console.log(`Failed: ${summary.failed}`);

for (const result of summary.results) {
	if (result.error) {
		console.error(`Error for ${result.filePath}: ${result.error}`);
		continue;
	}
	const cameraModel = result.metadata?.propertyMap['camera.model']?.value;
	console.log(`File: ${result.filePath}`);
	console.log(`Camera: ${cameraModel ?? 'unknown'}`);
	if (result.thumbnailPath) {
		console.log(`Thumbnail written to: ${result.thumbnailPath}`);
	}
}
