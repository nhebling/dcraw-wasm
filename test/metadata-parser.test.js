import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMetadataText } from '../dist/index.js';

test('parseMetadataText maps known labels to stable ids and typed values', () => {
	const metadataText = [
		'Camera: Sony ILCE-7M3',
		'ISO speed: 100',
		'Shutter: 1/125 sec',
		'Aperture: f/5.6',
		'Focal length: 55.0 mm',
		'Timestamp: Sun Mar 15 10:20:30 2026',
	].join('\n');

	const parsed = parseMetadataText(metadataText);

	assert.equal(parsed.propertyMap['camera.model'].value, 'Sony ILCE-7M3');
	assert.equal(parsed.propertyMap['exposure.iso'].value, 100);
	assert.equal(parsed.propertyMap['exposure.iso'].valueType, 'int');
	assert.equal(parsed.propertyMap['exposure.shutter'].valueType, 'fraction');
	assert.equal(parsed.propertyMap['lens.focalLengthMm'].value, 55);
	assert.equal(parsed.propertyMap['lens.focalLengthMm'].unit, 'mm');
	assert.equal(parsed.propertyMap['capture.timestamp'].valueType, 'datetime');
});

test('parseMetadataText preserves unknown labels with unknown.* ids', () => {
	const parsed = parseMetadataText('Custom thing: abc123');
	assert.equal(parsed.properties.length, 1);
	assert.equal(parsed.properties[0].id, 'unknown.custom_thing');
	assert.equal(parsed.properties[0].valueType, 'string');
});
