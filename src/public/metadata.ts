import type { FractionValue, MetadataProperty, MetadataValue, MetadataValueType, ParsedMetadata } from './types.js';

interface MetadataDefinition {
	id: string;
	label: string;
	valueTypeHint?: MetadataValueType;
	unit?: string;
}

const METADATA_DEFINITIONS: Record<string, MetadataDefinition> = {
	filename: { id: 'file.name', label: 'File Name', valueTypeHint: 'string' },
	timestamp: { id: 'capture.timestamp', label: 'Capture Timestamp', valueTypeHint: 'datetime' },
	camera: { id: 'camera.model', label: 'Camera', valueTypeHint: 'string' },
	iso_speed: { id: 'exposure.iso', label: 'ISO Speed', valueTypeHint: 'int', unit: 'ISO' },
	shutter: { id: 'exposure.shutter', label: 'Shutter', valueTypeHint: 'fraction', unit: 's' },
	aperture: { id: 'lens.apertureFNumber', label: 'Aperture', valueTypeHint: 'float' },
	focal_length: { id: 'lens.focalLengthMm', label: 'Focal Length', valueTypeHint: 'float', unit: 'mm' },
	raw_colors: { id: 'sensor.rawColorCount', label: 'Raw Colors', valueTypeHint: 'int' },
	filter_pattern: { id: 'sensor.filterPattern', label: 'Filter Pattern', valueTypeHint: 'string' },
	daylight_multipliers: {
		id: 'whiteBalance.daylightMultipliers',
		label: 'Daylight Multipliers',
		valueTypeHint: 'string',
	},
	cam_mul: { id: 'whiteBalance.cameraMultipliers', label: 'Camera Multipliers', valueTypeHint: 'string' },
	number_of_raw_images: { id: 'file.rawImageCount', label: 'Raw Image Count', valueTypeHint: 'int' },
	thumb_size: { id: 'image.thumbnailSize', label: 'Thumbnail Size', valueTypeHint: 'string' },
	full_size: { id: 'image.fullSize', label: 'Full Size', valueTypeHint: 'string' },
	image_size: { id: 'image.outputSize', label: 'Image Size', valueTypeHint: 'string' },
	output_size: { id: 'image.outputSizeSelected', label: 'Output Size', valueTypeHint: 'string' },
	embedded_icc_profile: { id: 'color.embeddedIccProfile', label: 'Embedded ICC Profile', valueTypeHint: 'boolean' },
};

function normalizeLabel(label: string): string {
	return label
		.trim()
		.toLowerCase()
		.replace(/\([^)]*\)/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function parseFraction(raw: string): FractionValue | null {
	const fractionMatch = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (!fractionMatch) {
		return null;
	}
	const numerator = Number.parseInt(fractionMatch[1], 10);
	const denominator = Number.parseInt(fractionMatch[2], 10);
	if (!denominator) {
		return null;
	}
	return {
		numerator,
		denominator,
		decimal: numerator / denominator,
	};
}

function parseBoolean(raw: string): boolean | null {
	const value = raw.trim().toLowerCase();
	if (value === 'yes' || value === 'true') {
		return true;
	}
	if (value === 'no' || value === 'false') {
		return false;
	}
	return null;
}

function parseTypedValue(
	rawValue: string,
	valueTypeHint?: MetadataValueType,
): {
	value: MetadataValue;
	valueType: MetadataValueType;
	unit: string | null;
} {
	const trimmed = rawValue.trim();

	if (valueTypeHint === 'datetime') {
		const date = new Date(trimmed);
		if (!Number.isNaN(date.getTime())) {
			return { value: date, valueType: 'datetime', unit: null };
		}
	}

	if (valueTypeHint === 'boolean') {
		const parsed = parseBoolean(trimmed);
		if (parsed !== null) {
			return { value: parsed, valueType: 'boolean', unit: null };
		}
	}

	if (valueTypeHint === 'fraction') {
		const clean = trimmed.replace(/\s*(sec|s)$/i, '').trim();
		const fraction = parseFraction(clean);
		if (fraction) {
			return { value: fraction, valueType: 'fraction', unit: 's' };
		}
	}

	if (valueTypeHint === 'int') {
		const intMatch = trimmed.match(/^-?\d+/);
		if (intMatch) {
			return { value: Number.parseInt(intMatch[0], 10), valueType: 'int', unit: null };
		}
	}

	if (valueTypeHint === 'float') {
		const floatMatch = trimmed.match(/^-?\d+(\.\d+)?/);
		if (floatMatch) {
			return { value: Number.parseFloat(floatMatch[0]), valueType: 'float', unit: null };
		}
	}

	const secFraction = parseFraction(trimmed.replace(/\s*(sec|s)$/i, '').trim());
	if (secFraction) {
		return { value: secFraction, valueType: 'fraction', unit: 's' };
	}

	const mmMatch = trimmed.match(/^(-?\d+(\.\d+)?)\s*mm$/i);
	if (mmMatch) {
		return { value: Number.parseFloat(mmMatch[1]), valueType: 'float', unit: 'mm' };
	}

	const floatMatch = trimmed.match(/^-?\d+(\.\d+)?$/);
	if (floatMatch) {
		if (floatMatch[0].includes('.')) {
			return { value: Number.parseFloat(floatMatch[0]), valueType: 'float', unit: null };
		}
		return { value: Number.parseInt(floatMatch[0], 10), valueType: 'int', unit: null };
	}

	const boolValue = parseBoolean(trimmed);
	if (boolValue !== null) {
		return { value: boolValue, valueType: 'boolean', unit: null };
	}

	return { value: trimmed, valueType: 'string', unit: null };
}

function parseMetadataLine(line: string): MetadataProperty | null {
	const separatorIndex = line.indexOf(':');
	if (separatorIndex <= 0) {
		return null;
	}

	const sourceLabel = line.slice(0, separatorIndex).trim();
	const rawValue = line.slice(separatorIndex + 1).trim();
	const normalizedLabel = normalizeLabel(sourceLabel);
	const definition = METADATA_DEFINITIONS[normalizedLabel];

	const parsed = parseTypedValue(rawValue, definition?.valueTypeHint);
	const id = definition?.id ?? `unknown.${normalizedLabel || 'label'}`;
	const label = definition?.label ?? sourceLabel;

	return {
		id,
		label,
		sourceLabel,
		value: parsed.value,
		valueType: parsed.valueType,
		unit: definition?.unit ?? parsed.unit,
		confidence: definition ? 'exact' : 'parsed',
		rawValue,
	};
}

export function parseMetadataText(rawText: string): ParsedMetadata {
	const lines = rawText
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	const properties: MetadataProperty[] = [];
	for (const line of lines) {
		const property = parseMetadataLine(line);
		if (property) {
			properties.push(property);
		}
	}

	const propertyMap: Record<string, MetadataProperty> = {};
	for (const property of properties) {
		propertyMap[property.id] = property;
	}

	return {
		rawText,
		lines,
		properties,
		propertyMap,
	};
}
