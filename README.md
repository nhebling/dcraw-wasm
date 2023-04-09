# dcraw-wasm

## WebAssembly (WASM) to convert RAW camera images

### Usage

todo

### Development

Instructions are explained for macOS, other platforms may vary. Some additional information to the general approach of building a WebAssembly can be found [here](https://marcoselvatici.github.io/WASM_tutorial/)

#### Prepare (Required tools)

Install [emscripten](https://emscripten.org/) by simply run:<br>
`brew install emscripten`

#### Build

`yarn build`<br>
_Calls the makefile and compiles the original dcraw C-code. Finally generates the .wasm and .js files using emscripten toolchain. Generated .wasm and .js are placed in `./bin` directory._

#### Run

`yarn start`
_Copies the build results from `./bin` directory to `./demo/bin` (necessary that `emrun` can serve these files). Runs `emrun` to start local dev server to serve the sample index.html._

### Test and verify

todo

## Motivation

This project is inspired by [dcraw.js](https://github.com/zfedoran/dcraw.js) which sadly seems not been maintained since 2017 at the point of starting this. Due to open PR's, missing ES6 support, missing WASM support I thought it might be a good idea to give it a chance and also learn something new. So I gave it a try.

## License

License for [dcraw.c](https://www.dechifro.org/dcraw/dcraw.c)<br>
License for remaining source code in this repository (excluding dependencies and libraries) can be found in [LICENSE](./LICENSE)
