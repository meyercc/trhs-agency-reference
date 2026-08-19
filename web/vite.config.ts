import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port: honour the PORT env when set (lets the preview tool's autoPort assign a
// free port when 5175 is already taken by another chat's dev server — avoids
// multi-session port clashes), else default 5175 (kept so it never collides with
// prototype Vite 5173 / react-lab 5174 / static 8080). fs.allow '..' lets us
// import the real shared/tokens.css + components.css from the parent project.
// (typed via globalThis so we don't need @types/node in this repo)
const envPort = Number(
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PORT,
);

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: Number.isFinite(envPort) && envPort > 0 ? envPort : 5175,
    fs: { allow: ['..'] },
  },
});
