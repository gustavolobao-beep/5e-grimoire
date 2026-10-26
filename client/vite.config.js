import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * O cliente fala com a API pelo proxy do Vite (/api e /socket.io),
 * então em desenvolvimento não há CORS nem configuração de URL.
 * Em produção o próprio Express serve o build (client/dist).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@shared': path.resolve(root, '../shared'),
    },
  },
  server: {
    port: 5173,
    // As regras de 5e ficam em ../shared e são importadas direto pelo cliente.
    fs: { allow: [path.resolve(root, '..')] },
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
