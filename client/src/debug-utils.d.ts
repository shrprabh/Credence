declare module "./debug-utils.js";

interface Window {
  displayAllMappings: () => Record<string, string>;
  Buffer: typeof Buffer;
}
