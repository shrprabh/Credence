import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: "globalThis", // This makes 'global' available, often needed with 'Buffer'
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true, // Polyfills 'process' (often used alongside Buffer)
          buffer: true, // Specifically polyfills 'Buffer'
        }),
      ],
    },
  },
  resolve: {
    alias: {
      // You might also need to alias 'stream' or other Node.js core modules
      // if other similar errors appear.
    },
  },
});
