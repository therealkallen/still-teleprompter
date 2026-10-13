import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Rust builds lock DLLs on Windows; only watch frontend sources.
    watch: { ignored: ['**/src-tauri/**', '**/release/**', '**/artifacts/**'] },
  },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
});
