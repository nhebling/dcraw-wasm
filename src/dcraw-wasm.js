class DcrawWasm {
	_thisProgram = './this.program';
	_rawImageFileName = 'rawImageFile';
	_thumbImageFileName = 'rawImageFile.thumb.jpg';
	_stdout = [];
	_lastRunError = null;
	FS = null;
	_module;
	_moduleFactory;
	_argumentMappingBoolean = {
		verbose: 'v', //<boolean>  Print verbose messages
		identify: 'i', //<boolean>  Identify files without decoding them (use with '-v' to identify files and show metadata)
		toStandardOutput: 'c', //<boolean>  Write image data to standard output
		extractThumbnail: 'e', //<boolean>  Extract embedded thumbnail image
		updateFileDate: 'z', //<boolean>  Change file dates to camera timestamp
		useCameraWhiteBalance: 'w', //<boolean>  Use camera white balance, if possible
		useAverageWhiteBalance: 'a', //<boolean>  Average the whole image for white balance
		useEmbeddedColorMatrix: 'M', //<boolean>  Use/don't use an embedded color matrix
		useDocumentMode: 'd', //<boolean>  Document mode (no color, no interpolation, no debayer)
		useRawMode: 'D', //<boolean>  Document mode without scaling (totally raw)
		useExportMode: 'E', //<boolean>  Document mode without cropping
		setNoStretchMode: 'j', //<boolean>  Don't stretch or rotate raw pixels
		setNoAutoBrightnessMode: 'W', //<boolean>  Don't automatically brighten the image
		setHalfSizeMode: 'h', //<boolean>  Half-size color image (twice as fast as "-q 0")
		setFourColorMode: 'f', //<boolean>  Interpolate RGGB as four colors
		use16BitMode: '6', //<boolean>  Write 16-bit instead of 8-bit
		use16BitLinearMode: '4', //<boolean>  Linear 16-bit, same as "-6 -W -g 1 1"
		exportAsTiff: 'T', //<boolean>  Write TIFF instead of PPM
	};
	_argumentMappingBuffer = {
		deadPixelFile: 'P', //<buffer>   Fix the dead pixels listed in this file
		darkFrameFile: 'K', //<buffer>   Subtract dark frame (16-bit raw PGM)
		setICCFromFile: 'o', //<buffer>   Apply output ICC profile from file
		setICCFromCamera: 'p', //<buffer>   Apply camera ICC profile from file or "embed"
	};
	_argumentMappingValues = {
		whiteBalanceBox: 'A', //<x y w h>  Average a grey box for white balance
		useCustomWhiteBalance: 'r', //<r g b g>  Set custom white balance
		correctChromaticAberration: 'C', //<r b>      Correct chromatic aberration
		setDarknessLevel: 'k', //<num>      Set the darkness level
		setSaturationLevel: 'S', //<num>      Set the saturation level
		setWaveletThreshold: 'n', //<num>      Set threshold for wavelet denoising
		setHighlightMode: 'H', //[0-9]      Highlight mode (0=clip, 1=unclip, 2=blend, 3+=rebuild)
		setFlipMode: 't', //[0-7]      Flip image (0=none, 3=180, 5=90CCW, 6=90CW)
		setColorSpace: 'o', //[0-6]      Output colorspace (raw,sRGB,Adobe,Wide,ProPhoto,XYZ,ACES)
		setBrightnessLevel: 'b', //<num>      Adjust brightness (default = 1.0)
		setCustomGammaCurve: 'g', //<p ts>     Set custom gamma curve (default = 2.222 4.5)
		setInterpolationQuality: 'q', //[0-3]      Set the interpolation quality
		setMedianFilter: 'm', //<num>      Apply a 3x3 median filter to R-G and B-G
		setImageCount: 's', //[0..N-1]   Select one raw image or "all" from each file
	};
	async _loadModuleFactory() {
		if (this._moduleFactory) {
			return this._moduleFactory;
		}

		const candidates = ['./bin/dcraw.js', '../bin/dcraw.js'];
		for (const candidate of candidates) {
			try {
				const loaded = await import(candidate);
				this._moduleFactory = loaded.default;
				return this._moduleFactory;
			} catch {
				// Try the next candidate path.
			}
		}

		throw new Error('Unable to locate dcraw module factory (dcraw.js).');
	}

	async init(moduleOptions = {}) {
		const moduleFactory = await this._loadModuleFactory();
		const defaultModuleOptions = {
			print: (line) => this._printStdOut(line),
		};

		this._module = await moduleFactory({
			...defaultModuleOptions,
			...moduleOptions,
		});
		this.FS = this._module.FS;
	}
	_printStdOut(stdOut) {
		this._stdout.push(stdOut);
	}
	_clearStdOut() {
		this._stdout = [];
	}
	_readStdOut() {
		return this._stdout.join('\n');
	}
	_runDcraw(args) {
		let stackPointer = 0;
		try {
			const params = args;
			const pointerSize = 4;
			stackPointer = this._module.stackSave();

			// Allocate and encode argument strings in WASM stack memory.
			const paramStrings = params.map((str) => {
				const byteLength = str.length * 4 + 1;
				const strPtr = this._module.stackAlloc(byteLength);
				this._module.stringToUTF8(str, strPtr, byteLength);
				return strPtr;
			});

			// Create a null-terminated argv array.
			const paramArray = this._module.stackAlloc((paramStrings.length + 1) * pointerSize);
			paramStrings.forEach((strPtr, i) => {
				this._module.setValue(paramArray + i * pointerSize, strPtr, 'i32');
			});
			this._module.setValue(paramArray + paramStrings.length * pointerSize, 0, 'i32');

			// Call the `_runMain` (alias for main) method with argc and argv.
			this._module['_runMain'](paramStrings.length, paramArray);
			return true;
		} catch (error) {
			this._lastRunError = error;
			console.error(`Error executing dcraw with args ${args}\n: ${error}`);
			return false;
		} finally {
			if (stackPointer) {
				this._module.stackRestore(stackPointer);
			}
		}
	}
	_saveFileToMemFs(rawFileBuffer, fileName) {
		if (!rawFileBuffer) {
			throw new Error(`Abort. No file loaded to buffer.`);
		}
		if (!fileName) {
			throw new Error(`Abort. No file name provided.`);
		}
		this.FS.writeFile(fileName, rawFileBuffer);
	}
	_cleanupMemFs(fileName) {
		if (!fileName) {
			throw new Error(`Abort. No file name provided.`);
		}
		this.FS.unlink(fileName);
	}
	_isFileExisting(fileName) {
		if (!fileName) {
			throw new Error(`Abort. No file name provided.`);
		}
		const result = this.FS.analyzePath(fileName, true);
		if (result && result.exists) {
			return result.path;
		}
		return null;
	}
	_readThumbnail() {
		const thumbnailPath = this._isFileExisting(this._thumbImageFileName);
		if (thumbnailPath) {
			const rawThumbnail = this.FS.readFile(thumbnailPath, { encoding: 'binary' });
			this._cleanupMemFs(this._thumbImageFileName);
			return rawThumbnail;
		}
		return new Uint8Array();
	}

	_mapBooleanOptionsToArgs(options) {
		const args = Object.keys(options)
			.filter((key) => options[key] && this._argumentMappingBoolean[key])
			.map((key) => `-${this._argumentMappingBoolean[key]}`);
		return args.length > 0 ? args : [];
	}

	_mapValueOptionsToArgs(options) {
		const args = Object.entries(options)
			.filter(([key, value]) => value && this._argumentMappingValues[key])
			.map(([key, value]) => `-${this._argumentMappingValues[key]} ${value}`);
		return args.length > 0 ? args : [];
	}

	run(rawFileBuffer, options = {}) {
		if (this._module) {
			this._lastRunError = null;
			const mandatoryArgs = [this._thisProgram];
			const booleanArgs = this._mapBooleanOptionsToArgs(options);
			const valueArgs = this._mapValueOptionsToArgs(options);

			var args = mandatoryArgs.concat(booleanArgs).concat(valueArgs);

			// Save raw camera image file to MEMFS filesystem and add filename to args
			this._saveFileToMemFs(rawFileBuffer, this._rawImageFileName);
			args.push(this._rawImageFileName);

			this._clearStdOut();
			const runSucceeded = this._runDcraw(args);
			this._cleanupMemFs(this._rawImageFileName);
			if (!runSucceeded) {
				return options.extractThumbnail ? new Uint8Array() : '';
			}
			if (options.extractThumbnail) {
				return this._readThumbnail();
			}
			return this._readStdOut();
		}

		throw new Error('DcrawWasm is not initialized. Call init() before run().');
	}

	runSafe(rawFileBuffer, options = {}) {
		try {
			const result = this.run(rawFileBuffer, options);

			if (this._lastRunError) {
				return {
					ok: false,
					data: null,
					error: `dcraw execution failed: ${this._lastRunError.message || this._lastRunError}`,
				};
			}

			if (options.extractThumbnail) {
				if (!(result instanceof Uint8Array) || result.length === 0) {
					return {
						ok: false,
						data: null,
						error: 'No thumbnail output generated. The file may be unsupported or corrupted.',
					};
				}
			} else if (typeof result !== 'string' || result.trim().length === 0) {
				return {
					ok: false,
					data: null,
					error: 'No metadata output generated. The file may be unsupported or corrupted.',
				};
			}

			return { ok: true, data: result, error: null };
		} catch (error) {
			return {
				ok: false,
				data: null,
				error: error?.message || `${error}`,
			};
		}
	}
}

export { DcrawWasm };
