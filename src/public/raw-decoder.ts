import { parseMetadataText } from './metadata.js';
import type { AnalyzeOptions, DecodeOptions, ParsedMetadata, SafeResult } from './types.js';

interface DcrawWasmRuntime {
	init(moduleOptions?: Record<string, unknown>): Promise<void>;
	run(rawFileBuffer: Uint8Array, options?: Record<string, unknown>): string | Uint8Array;
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
	// Retained for runInternal() only — not required for standard decode methods.
	private runtime: DcrawWasmRuntime | null = null;
	// Stored from init() and forwarded to isolated runs (e.g. locateFile for WASM path).
	private moduleOptions: Record<string, unknown> = {};

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

	// Creates a fresh runtime using stored module options, executes one operation,
	// then discards the runtime. This is the safe execution path — each call is fully isolated.
	private async runIsolated<T>(operation: (runtime: DcrawWasmRuntime) => T): Promise<T> {
		const RuntimeClass = await RawDecoder.loadInternalRuntime();
		const runtime = new RuntimeClass();
		await runtime.init(this.moduleOptions);
		return operation(runtime);
	}

	/**
	 * Optional warmup step. Initializes and caches a runtime instance for use
	 * with `runInternal()`. Standard decode methods (`readMetadata`,
	 * `extractThumbnail`, `analyze`) do not require `init()` — they manage their
	 * own isolated runtimes internally.
	 */
	async init(moduleOptions: Record<string, unknown> = {}): Promise<void> {
		this.moduleOptions = moduleOptions;
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
			throw new Error('RawDecoder is not initialized. Call init() before using runInternal().');
		}
		return this.runtime;
	}

	async readMetadata(rawBuffer: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): Promise<ParsedMetadata> {
		const normalized = normalizeRawBuffer(rawBuffer);
		const runOptions = {
			...mapDecodeOptions(options),
			identify: true,
			verbose: options.verbose ?? true,
		};
		return this.runIsolated((runtime) => {
			const result = runtime.run(normalized, runOptions);
			if (typeof result !== 'string') {
				throw new Error('Expected metadata output as string, but received binary output.');
			}
			return parseMetadataText(result);
		});
	}

	async extractThumbnail(rawBuffer: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): Promise<Uint8Array> {
		const normalized = normalizeRawBuffer(rawBuffer);
		return this.runIsolated((runtime) => {
			const result = runtime.run(normalized, {
				...mapDecodeOptions(options),
				extractThumbnail: true,
			});
			if (!(result instanceof Uint8Array)) {
				throw new Error('Expected thumbnail output as Uint8Array, but received text output.');
			}
			return result;
		});
	}

	async analyze(
		rawBuffer: Uint8Array | ArrayBuffer,
		options: AnalyzeOptions = {},
	): Promise<{
		metadata: ParsedMetadata | null;
		thumbnail: Uint8Array | null;
	}> {
		const includeMetadata = options.includeMetadata ?? true;
		const includeThumbnail = options.includeThumbnail ?? true;
		const normalizedBuffer = normalizeRawBuffer(rawBuffer);

		return {
			metadata: includeMetadata ? await this.readMetadata(normalizedBuffer, options) : null,
			thumbnail: includeThumbnail ? await this.extractThumbnail(normalizedBuffer, options) : null,
		};
	}

	async readMetadataSafe(
		rawBuffer: Uint8Array | ArrayBuffer,
		options: DecodeOptions = {},
	): Promise<SafeResult<ParsedMetadata>> {
		try {
			const metadata = await this.readMetadata(rawBuffer, options);
			return { ok: true, data: metadata, error: null };
		} catch (error) {
			return {
				ok: false,
				data: null,
				error: error instanceof Error ? error.message : `${error}`,
			};
		}
	}

	async extractThumbnailSafe(
		rawBuffer: Uint8Array | ArrayBuffer,
		options: DecodeOptions = {},
	): Promise<SafeResult<Uint8Array>> {
		try {
			const thumbnail = await this.extractThumbnail(rawBuffer, options);
			return { ok: true, data: thumbnail, error: null };
		} catch (error) {
			return {
				ok: false,
				data: null,
				error: error instanceof Error ? error.message : `${error}`,
			};
		}
	}

	/**
	 * Advanced/low-level escape hatch. Requires a prior `init()` call.
	 * The underlying runtime instance is one-shot — calling this more than once
	 * on the same `RawDecoder` instance may produce incorrect results.
	 * Prefer `readMetadata`, `extractThumbnail`, or `analyze` for safe repeated use.
	 */
	runInternal(rawBuffer: Uint8Array | ArrayBuffer, internalOptions: Record<string, unknown>): string | Uint8Array {
		const runtime = this.requireRuntime();
		return runtime.run(normalizeRawBuffer(rawBuffer), internalOptions);
	}
}
