import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 3000,
      proxy: {
        // Proxy API requests to your backend server
        '/api': {
          target: 'http://127.0.0.1:8000', // Your backend server
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});