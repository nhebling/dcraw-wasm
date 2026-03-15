import { RawDecoder } from './raw-decoder.js';
import type { AnalyzeOptions, ParsedMetadata } from './types.js';

async function runWithFreshDecoder<T>(operation: (decoder: RawDecoder) => T): Promise<T> {
	const decoder = new RawDecoder();
	await decoder.init();
	return operation(decoder);
}

export async function analyzeBufferIsolated(
	rawBuffer: Uint8Array,
	options: AnalyzeOptions = {},
): Promise<{
	metadata: ParsedMetadata | null;
	thumbnail: Uint8Array | null;
}> {
	const includeMetadata = options.includeMetadata ?? true;
	const includeThumbnail = options.includeThumbnail ?? true;

	return {
		metadata: includeMetadata ? await runWithFreshDecoder((decoder) => decoder.readMetadata(rawBuffer, options)) : null,
		thumbnail: includeThumbnail
			? await runWithFreshDecoder((decoder) => decoder.extractThumbnail(rawBuffer, options))
			: null,
	};
}
