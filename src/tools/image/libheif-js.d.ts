// Minimal typing for the high-level libheif-js API we use. The package ships a .d.ts, but it only covers
// the low-level emscripten bindings — the ergonomic HeifDecoder/HeifImage surface lives in the JS wrapper
// and is untyped, and the '/wasm-bundle' subpath (WASM embedded, browser-friendly) has no declaration at
// all. We type just what heic.worker.ts calls. See node_modules/libheif-js/README.md.
declare module 'libheif-js/wasm-bundle' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    /** Fills `target.data` with RGBA pixels (orientation already applied), then calls back with the
     *  filled object, or a falsy value on failure. */
    display(target: ImageData, done: (result: ImageData | null) => void): void;
  }
  interface HeifDecoder {
    decode(buffer: Uint8Array): HeifImage[];
  }
  const libheif: { HeifDecoder: { new (): HeifDecoder } };
  export default libheif;
}
