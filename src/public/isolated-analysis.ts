import { RawDecoder } from './raw-decoder.js';
import type { AnalyzeOptions, ParsedMetadata } from './types.js';

export async function analyzeBufferIsolated(
	rawBuffer: Uint8Array,
	options: AnalyzeOptions = {},
): Promise<{
	metadata: ParsedMetadata | null;
	thumbnail: Uint8Array | null;
}> {
	const decoder = new RawDecoder();
	return decoder.analyze(rawBuffer, options);
}
