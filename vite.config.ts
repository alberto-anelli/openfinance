import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
/*    proxy: {
      '/content/finance/api': {
        target: 'http://127.0.0.1:3900',
        changeOrigin: true,
      },
    },*/
  },
});
