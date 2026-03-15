import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { RawDecoder } from './raw-decoder.js';
import type { NodeBatchOptions, NodeBatchSummary, NodeFileAnalysisResult } from './types.js';

async function ensureDirectory(dirPath: string): Promise<void> {
	await fsPromises.mkdir(dirPath, { recursive: true });
}

function thumbnailOutputPath(inputPath: string, outputDir: string): string {
	const parsed = path.parse(inputPath);
	return path.join(outputDir, `${parsed.name}.thumb.jpg`);
}

export async function analyzeNodeFiles(filePaths: string[], options: NodeBatchOptions = {}): Promise<NodeBatchSummary> {
	const concurrency = Math.max(1, options.concurrency ?? 1);
	const results: NodeFileAnalysisResult[] = new Array(filePaths.length);

	if (options.thumbnailOutputDir) {
		await ensureDirectory(options.thumbnailOutputDir);
	}

	let cursor = 0;
	const workers = Array.from({ length: Math.min(concurrency, filePaths.length) }, async () => {
		const decoder = new RawDecoder();
		await decoder.init();

		while (true) {
			const currentIndex = cursor;
			cursor += 1;
			if (currentIndex >= filePaths.length) {
				return;
			}

			const filePath = filePaths[currentIndex];
			options.onProgress?.({
				index: currentIndex,
				total: filePaths.length,
				filePath,
				status: 'processing',
			});

			try {
				const fileBytes = new Uint8Array(await fsPromises.readFile(filePath));
				const analysis = decoder.analyze(fileBytes, options);
				let outputPath: string | undefined;
				if (options.thumbnailOutputDir && analysis.thumbnail) {
					outputPath = thumbnailOutputPath(filePath, options.thumbnailOutputDir);
					await fsPromises.writeFile(outputPath, analysis.thumbnail);
				}
				results[currentIndex] = {
					fileName: path.basename(filePath),
					filePath,
					metadata: analysis.metadata,
					thumbnail: analysis.thumbnail,
					thumbnailPath: outputPath,
					error: null,
				};
				options.onProgress?.({
					index: currentIndex,
					total: filePaths.length,
					filePath,
					status: 'done',
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : `${error}`;
				results[currentIndex] = {
					fileName: path.basename(filePath),
					filePath,
					metadata: null,
					thumbnail: null,
					error: message,
				};
				options.onProgress?.({
					index: currentIndex,
					total: filePaths.length,
					filePath,
					status: 'error',
					error: message,
				});
			}
		}
	});

	await Promise.all(workers);

	let succeeded = 0;
	for (const result of results) {
		if (result && !result.error) {
			succeeded += 1;
		}
	}

	return {
		total: filePaths.length,
		succeeded,
		failed: filePaths.length - succeeded,
		results,
	};
}
