# RawDecoder Safe Reuse Redesign Plan

## Problem

`dcraw` execution inside the current WebAssembly runtime is not safely reusable across repeated calls on the same initialized instance. A second metadata or thumbnail extraction can fail with `RuntimeError: memory access out of bounds`.

Today this is worked around in the browser and Node convenience helpers by creating fresh decoder/runtime instances per operation. That keeps the demos and batch helpers working, but it does not solve direct repeated calls through `RawDecoder` itself.

## Goal

Redesign `RawDecoder` so repeated decode calls are safe and supported as a first-class API behavior.

## Non-Goals

- Do not modify vendored `src/lib/dcraw.c` unless investigation proves it is required.
- Do not break existing package entry points unless there is a clearly documented migration path.
- Do not reintroduce reliance on the low-level internal runtime for multi-step decode flows without explicit lifecycle control.

## Proposed Direction

Make decode operations async and let each operation manage its own runtime lifecycle.

Candidate API shape:

```ts
const decoder = new RawDecoder();

await decoder.readMetadata(rawBuffer, options);
await decoder.extractThumbnail(rawBuffer, options);
await decoder.analyze(rawBuffer, options);
```

Implementation intent:

- `init()` becomes optional or is repurposed as a warmup/cache step.
- Each decode operation creates a fresh internal `DcrawWasm` runtime, initializes it, runs exactly one decode, then releases references.
- `analyze()` performs metadata and thumbnail extraction through separate isolated runs.
- Safe wrappers continue to exist and stay async.

## Design Options

### Option 1: Fully isolated runtime per operation

Pros:

- Safest behavior with current known runtime limitation.
- Minimal coupling to low-level mutable runtime state.
- Straightforward reasoning and testing.

Cons:

- Higher per-call startup cost.
- API becomes async for direct consumers.

### Option 2: Runtime pool with one-shot workers

Pros:

- Preserves isolation while allowing pre-initialized workers.
- Can improve throughput for batch processing.

Cons:

- More complex lifecycle and error handling.
- Probably unnecessary for the first safe redesign.

### Option 3: Keep sync API and silently recreate runtime internally

Pros:

- Smaller API surface change.

Cons:

- Hard to implement cleanly because runtime initialization is async.
- Encourages hidden state and awkward pre-init rules.

Recommendation: start with Option 1, then evaluate pooling later if startup cost is significant.

## Migration Plan

1. Introduce async `RawDecoder` methods behind a minor-version feature flag or new class shape.
2. Keep current convenience helpers on top of the new async internals.
3. Deprecate sync direct decode methods in documentation.
4. In the next breaking release, remove or rename the old sync methods.

## Implementation Steps

1. Add an internal async helper that creates, initializes, and disposes a fresh `DcrawWasm` instance for one operation.
2. Refactor `RawDecoder` methods to use that helper and return promises.
3. Update browser and Node convenience helpers to call the new async methods directly instead of separate workaround helpers.
4. Update demos to use the async direct API.
5. Keep `runInternal()` as explicitly unsafe/advanced, or move it behind a lower-level class that exposes the one-shot limitation clearly.
6. Update README examples and API docs.
7. Add regression tests for repeated metadata calls, repeated thumbnail calls, and mixed metadata-plus-thumbnail flows on one `RawDecoder` instance.

## Test Plan

- Repeated `readMetadata()` calls on one `RawDecoder` instance succeed.
- Repeated `extractThumbnail()` calls on one `RawDecoder` instance succeed.
- `analyze()` returns both metadata and thumbnail across repeated calls.
- Browser convenience demo still works.
- Node batch helper still works with concurrency greater than 1.
- Tarball integration test still passes.

## Open Questions

- Is there a reliable low-level cleanup/reset path in the generated Emscripten module that would avoid full runtime recreation?
- Is the startup overhead of per-operation initialization acceptable for browser multi-file workflows?
- Should `RawDecoder` keep an explicit `init()` at all once direct operations are async?
