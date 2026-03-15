import { parseMetadataText } from './metadata.js';
import type { AnalyzeOptions, DecodeOptions, ParsedMetadata, SafeResult } from './types.js';

interface DcrawSafeRunResult {
	ok: boolean;
	data: string | Uint8Array | null;
	error: string | null;
}

interface DcrawWasmRuntime {
	init(moduleOptions?: Record<string, unknown>): Promise<void>;
	run(rawFileBuffer: Uint8Array, options?: Record<string, unknown>): string | Uint8Array;
	runSafe(rawFileBuffer: Uint8Array, options?: Record<string, unknown>): DcrawSafeRunResult;
}

interface DcrawWasmConstructor {
	new (): DcrawWasmRuntime;
}

function normalizeRawBuffer(rawBuffer: Uint8Array | ArrayBuffer): Uint8Array {
	if (!(rawBuffer instanceof Uint8Array) && !(rawBuffer instanceof ArrayBuffer)) {
		throw new Error('A RAW file buffer must be provided as Uint8Array or ArrayBuffer.');
	}
	if (rawBuffer instanceof Uint8Array) {
		if (rawBuffer.length === 0) {
			throw new Error('A RAW file buffer must not be empty.');
		}
		return rawBuffer;
	}
	const normalized = new Uint8Array(rawBuffer);
	if (normalized.length === 0) {
		throw new Error('A RAW file buffer must not be empty.');
	}
	return normalized;
}

function mapDecodeOptions(options: DecodeOptions = {}): Record<string, unknown> {
	const mapped: Record<string, unknown> = {};
	if (options.verbose !== undefined) {
		mapped.verbose = options.verbose;
	}

	if (options.interpolationQuality !== undefined) {
		mapped.setInterpolationQuality = options.interpolationQuality;
	}
	if (options.brightness !== undefined) {
		mapped.setBrightnessLevel = options.brightness;
	}
	if (options.colorSpace !== undefined) {
		mapped.setColorSpace = options.colorSpace;
	}
	if (options.halfSize !== undefined) {
		mapped.setHalfSizeMode = options.halfSize;
	}
	if (options.cameraWhiteBalance !== undefined) {
		mapped.useCameraWhiteBalance = options.cameraWhiteBalance;
	}
	if (options.averageWhiteBalance !== undefined) {
		mapped.useAverageWhiteBalance = options.averageWhiteBalance;
	}
	if (options.noAutoBrightness !== undefined) {
		mapped.setNoAutoBrightnessMode = options.noAutoBrightness;
	}

	return mapped;
}

export class RawDecoder {
	private runtime: DcrawWasmRuntime | null = null;
	private static async loadInternalRuntime(): Promise<DcrawWasmConstructor> {
		const candidates = [
			new URL('../src/dcraw-wasm.js', import.meta.url).href,
			new URL('../dcraw-wasm.js', import.meta.url).href,
		];

		for (const candidate of candidates) {
			try {
				const imported = (await import(candidate)) as { DcrawWasm?: DcrawWasmConstructor };
				if (imported.DcrawWasm) {
					return imported.DcrawWasm;
				}
			} catch {
				// Try next candidate.
			}
		}

		throw new Error('Unable to locate internal runtime module (dcraw-wasm.js).');
	}

	async init(moduleOptions: Record<string, unknown> = {}): Promise<void> {
		if (this.runtime) {
			return;
		}

		const RuntimeClass = await RawDecoder.loadInternalRuntime();
		const runtime = new RuntimeClass();
		await runtime.init(moduleOptions);
		this.runtime = runtime;
	}

	isInitialized(): boolean {
		return this.runtime !== null;
	}

	private requireRuntime(): DcrawWasmRuntime {
		if (!this.runtime) {
			throw new Error('RawDecoder is not initialized. Call init() before using decode methods.');
		}
		return this.runtime;
	}

	readMetadata(rawBuffer: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): ParsedMetadata {
		const runtime = this.requireRuntime();
		const runOptions = {
			...mapDecodeOptions(options),
			identify: true,
			verbose: options.verbose ?? true,
		};
		const result = runtime.run(normalizeRawBuffer(rawBuffer), runOptions);
		if (typeof result !== 'string') {
			throw new Error('Expected metadata output as string, but received binary output.');
		}
		return parseMetadataText(result);
	}

	extractThumbnail(rawBuffer: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): Uint8Array {
		const runtime = this.requireRuntime();
		const result = runtime.run(normalizeRawBuffer(rawBuffer), {
			...mapDecodeOptions(options),
			extractThumbnail: true,
		});
		if (!(result instanceof Uint8Array)) {
			throw new Error('Expected thumbnail output as Uint8Array, but received text output.');
		}
		return result;
	}

	analyze(
		rawBuffer: Uint8Array | ArrayBuffer,
		options: AnalyzeOptions = {},
	): {
		metadata: ParsedMetadata | null;
		thumbnail: Uint8Array | null;
	} {
		const includeMetadata = options.includeMetadata ?? true;
		const includeThumbnail = options.includeThumbnail ?? true;
		const normalizedBuffer = normalizeRawBuffer(rawBuffer);

		return {
			metadata: includeMetadata ? this.readMetadata(normalizedBuffer, options) : null,
			thumbnail: includeThumbnail ? this.extractThumbnail(normalizedBuffer, options) : null,
		};
	}

	readMetadataSafe(rawBuffer: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): SafeResult<ParsedMetadata> {
		try {
			const runtime = this.requireRuntime();
			const result = runtime.runSafe(normalizeRawBuffer(rawBuffer), {
				...mapDecodeOptions(options),
				identify: true,
				verbose: options.verbose ?? true,
			});

			if (!result.ok || typeof result.data !== 'string') {
				return {
					ok: false,
					data: null,
					error: result.error ?? 'Failed to extract metadata.',
				};
			}

			return {
				ok: true,
				data: parseMetadataText(result.data),
				error: null,
			};
		} catch (error) {
			return {
				ok: false,
				data: null,
				error: error instanceof Error ? error.message : `${error}`,
			};
		}
	}

	extractThumbnailSafe(rawBuffer: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): SafeResult<Uint8Array> {
		try {
			const runtime = this.requireRuntime();
			const result = runtime.runSafe(normalizeRawBuffer(rawBuffer), {
				...mapDecodeOptions(options),
				extractThumbnail: true,
			});

			if (!result.ok || !(result.data instanceof Uint8Array)) {
				return {
					ok: false,
					data: null,
					error: result.error ?? 'Failed to extract thumbnail.',
				};
			}

			return {
				ok: true,
				data: result.data,
				error: null,
			};
		} catch (error) {
			return {
				ok: false,
				data: null,
				error: error instanceof Error ? error.message : `${error}`,
			};
		}
	}

	runInternal(rawBuffer: Uint8Array | ArrayBuffer, internalOptions: Record<string, unknown>): string | Uint8Array {
		const runtime = this.requireRuntime();
		return runtime.run(normalizeRawBuffer(rawBuffer), internalOptions);
	}
}
