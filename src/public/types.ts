export type MetadataValueType = 'string' | 'int' | 'float' | 'fraction' | 'datetime' | 'boolean' | 'unknown';

export type MetadataConfidence = 'exact' | 'inferred' | 'parsed';

export interface FractionValue {
	numerator: number;
	denominator: number;
	decimal: number;
}

export type MetadataValue = string | number | boolean | Date | FractionValue;

export interface MetadataProperty {
	id: string;
	label: string;
	sourceLabel: string;
	value: MetadataValue;
	valueType: MetadataValueType;
	unit: string | null;
	confidence: MetadataConfidence;
	rawValue: string;
}

export interface ParsedMetadata {
	rawText: string;
	lines: string[];
	properties: MetadataProperty[];
	propertyMap: Record<string, MetadataProperty>;
}

export interface DecodeOptions {
	interpolationQuality?: 0 | 1 | 2 | 3;
	brightness?: number;
	colorSpace?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	halfSize?: boolean;
	cameraWhiteBalance?: boolean;
	averageWhiteBalance?: boolean;
	noAutoBrightness?: boolean;
	verbose?: boolean;
}

export interface AnalyzeOptions extends DecodeOptions {
	includeMetadata?: boolean;
	includeThumbnail?: boolean;
}

export interface SafeResult<T> {
	ok: boolean;
	data: T | null;
	error: string | null;
}

export interface FileAnalysisResult {
	fileName: string;
	metadata: ParsedMetadata | null;
	thumbnail: Uint8Array | null;
	error: string | null;
}

export interface NodeFileAnalysisResult extends FileAnalysisResult {
	filePath: string;
	thumbnailPath?: string;
}

export interface BrowserBatchOptions extends AnalyzeOptions {
	onProgress?: (event: {
		index: number;
		total: number;
		fileName: string;
		status: 'processing' | 'done' | 'error';
		error?: string;
	}) => void;
}

export interface NodeBatchOptions extends AnalyzeOptions {
	concurrency?: number;
	thumbnailOutputDir?: string;
	onProgress?: (event: {
		index: number;
		total: number;
		filePath: string;
		status: 'processing' | 'done' | 'error';
		error?: string;
	}) => void;
}

export interface NodeBatchSummary {
	total: number;
	succeeded: number;
	failed: number;
	results: NodeFileAnalysisResult[];
}
