import { RawDecoder } from './raw-decoder.js';
import type { BrowserBatchOptions, FileAnalysisResult } from './types.js';

function toFileArray(files: FileList | File[]): File[] {
	if (Array.isArray(files)) {
		return files;
	}
	return Array.from(files);
}

export async function analyzeBrowserFiles(
	files: FileList | File[],
	options: BrowserBatchOptions = {},
): Promise<FileAnalysisResult[]> {
	const fileArray = toFileArray(files);
	const decoder = new RawDecoder();
	await decoder.init();

	const results: FileAnalysisResult[] = [];
	for (let index = 0; index < fileArray.length; index += 1) {
		const file = fileArray[index];
		options.onProgress?.({
			index,
			total: fileArray.length,
			fileName: file.name,
			status: 'processing',
		});

		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const analysis = decoder.analyze(bytes, options);
			results.push({
				fileName: file.name,
				metadata: analysis.metadata,
				thumbnail: analysis.thumbnail,
				error: null,
			});
			options.onProgress?.({
				index,
				total: fileArray.length,
				fileName: file.name,
				status: 'done',
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : `${error}`;
			results.push({
				fileName: file.name,
				metadata: null,
				thumbnail: null,
				error: message,
			});
			options.onProgress?.({
				index,
				total: fileArray.length,
				fileName: file.name,
				status: 'error',
				error: message,
			});
		}
	}

	return results;
}

export async function analyzeDroppedFiles(
	dataTransfer: DataTransfer,
	options: BrowserBatchOptions = {},
): Promise<FileAnalysisResult[]> {
	return analyzeBrowserFiles(dataTransfer.files, options);
}
