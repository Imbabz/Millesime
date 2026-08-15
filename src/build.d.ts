/**
 * Injected by Vite's `define` at build time, so the running app can say which
 * build it is. Under Vitest there is no `define`, hence the guarded read in
 * `buildStamp()`.
 */
declare const __BUILD_TIME__: string;
