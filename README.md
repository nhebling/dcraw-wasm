# dcraw-wasm

## WebAssembly (WASM) RAW camera parser for browser apps

`dcraw-wasm` compiles `dcraw.c` to WebAssembly and exposes a JavaScript API that can:

- extract RAW metadata
- extract embedded JPEG thumbnails

The package now exposes a typed TypeScript-first public API with convenience layers for browser and Node batch workflows.

It currently exposes three API styles: an advanced `RawDecoder` facade for full control, browser convenience helpers for file/drop workflows, and Node.js batch helpers for mass processing. See [API](#api), [Convenience Layers](#convenience-layers), and [Node.js Batch Processing](#nodejs-batch-processing) for details.

This package is intended for browser-based workflows where RAW files are provided as `Uint8Array`.

## Installation

```bash
npm i dcraw-wasm
```

## Quick Start (Browser)

```js
import { analyzeBrowserFiles } from 'dcraw-wasm/browser';

const results = await analyzeBrowserFiles(fileInput.files, {
	includeMetadata: true,
	includeThumbnail: true,
});

for (const result of results) {
	if (result.error) {
		console.error(result.fileName, result.error);
		continue;
	}

	console.log(result.metadata?.propertyMap['camera.model']?.value);
	console.log(result.thumbnail?.length);
}
```

If your bundler or hosting setup serves static assets from a custom path, use `locateFile` to point to `dcraw.wasm`.

## API

### `new RawDecoder()`

Creates the advanced decoder facade with full control.

### `await init(moduleOptions?)`

Initializes the Emscripten module.

- `moduleOptions` is optional and forwarded to the Emscripten module factory.
- Most useful option for consumers is `locateFile`.

Example:

```js
await decoder.init({
	locateFile: (path) => `/static/wasm/${path}`,
});
```

### `readMetadata(rawFileBuffer, options?)`

Extracts metadata and returns both raw text and typed metadata properties:

```ts
type ParsedMetadata = {
	rawText: string;
	lines: string[];
	properties: MetadataProperty[];
	propertyMap: Record<string, MetadataProperty>;
};
```

### `extractThumbnail(rawFileBuffer, options?)`

Extracts embedded thumbnail and returns `Uint8Array`.

### `analyze(rawFileBuffer, options?)`

Runs metadata and thumbnail extraction in one call and returns:

```ts
{
	metadata: ParsedMetadata | null;
	thumbnail: Uint8Array | null;
}
```

### `readMetadataSafe(...)` and `extractThumbnailSafe(...)`

Safe wrappers that return `{ ok, data, error }`.

### `runInternal(rawFileBuffer, internalOptions)`

Escape hatch for direct low-level option usage.

## Typed Metadata Model

`MetadataProperty` shape:

```ts
type MetadataProperty = {
	id: string; // stable key, e.g. "camera.model"
	label: string; // English display label
	sourceLabel: string; // original dcraw label
	value: string | number | boolean | Date | FractionValue;
	valueType: 'string' | 'int' | 'float' | 'fraction' | 'datetime' | 'boolean' | 'unknown';
	unit: string | null;
	confidence: 'exact' | 'inferred' | 'parsed';
	rawValue: string;
};
```

Unknown labels are preserved as `unknown.<normalized_label>` ids.

## Convenience Layers

### Browser

Import from `dcraw-wasm/browser`:

- `analyzeBrowserFiles(fileListOrArray, options?)`
- `analyzeDroppedFiles(dataTransfer, options?)`

Each returns an array of per-file results with metadata, thumbnail, and error isolation.

### Node.js Batch Processing

Import from `dcraw-wasm/node`:

```js
import { analyzeNodeFiles } from 'dcraw-wasm/node';

const summary = await analyzeNodeFiles(['/in/a.ARW', '/in/b.ARW'], {
	concurrency: 2,
	includeMetadata: true,
	includeThumbnail: true,
	thumbnailOutputDir: './thumbs',
});

console.log(summary.succeeded, summary.failed);
```

## Internal Runtime Access

The original low-level class is still available as an internal surface:

```js
import { DcrawWasm } from 'dcraw-wasm/internal';
```

Most consumers should use `RawDecoder` and convenience APIs; this path is for low-level control.

## Low-Level Option Examples

Common low-level flags mapped by the internal runtime include:

- `identify: true` (`-i`)
- `verbose: true` (`-v`)
- `extractThumbnail: true` (`-e`)
- `setBrightnessLevel: 1.0` (`-b`)
- `setInterpolationQuality: 3` (`-q`)

The typed facade prefers descriptive options (`brightness`, `interpolationQuality`, etc.) and maps them internally.

### Development

Instructions are explained for macOS; other platforms may vary. Some additional background on building WebAssembly can be found [here](https://marcoselvatici.github.io/WASM_tutorial/).

### Prepare (Required tools)

Install [emscripten](https://emscripten.org/):

```bash
brew install emscripten
```

### Build

```bash
npm run build         # dev profile (default)
npm run build:prod    # optimized profile
```

Build output is generated in `./bin`.

### Run Demo

```bash
npm run start
```

This copies runtime files to `./demo` and starts `emrun` with `demo/index.html`.

Demo index includes:

- browser convenience API demo (`demo/browser/convenience.html`)
- browser `RawDecoder` demo (`demo/browser/raw-decoder.html`)
- node batch API example (`demo/node/batch-example.js`)

Run the node demo with:

```bash
npm run demo:node
```

### Test and verify

```bash
npm test
```

Test workflow:

- uses `test/fixtures-local/SAMPLE.ARW` if present
- otherwise tries downloading `https://rawcameraimages.com/demo/SAMPLE.ARW`
- mirrors fixture into `test/fixtures/SAMPLE.ARW` for runtime compatibility
- runs smoke tests via `node:test`

Tarball integration test (publish-shape validation):

```bash
npm run test:pack
```

This packs the module, installs the tarball in a temporary sandbox, and runs one decode.

## Motivation

This project is inspired by [dcraw.js](https://github.com/zfedoran/dcraw.js) which sadly seems not been maintained since 2017 at the point of starting this. Due to open PR's, missing ES6 support, missing WASM support I thought it might be a good idea to give it a chance and also learn something new. So I gave it a try.

## License

License for [dcraw.c](https://www.dechifro.org/dcraw/dcraw.c).  
License for remaining source code in this repository (excluding dependencies and libraries) can be found in [LICENSE](./LICENSE).
