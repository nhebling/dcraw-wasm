# Node Demo

This folder contains a Node.js batch-processing example for the public `dcraw-wasm/node` API.

Main script: `demo/node/batch-example.js`

## Run

From the repository root:

```bash
npm run demo:node
```

The script:

- processes `test/fixtures/SAMPLE.ARW`
- extracts typed metadata
- writes thumbnail output to `demo/node/output`
- prints a summary and selected metadata fields
