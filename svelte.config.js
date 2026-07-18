import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'app.html',
      pages: 'build',
      assets: 'build',
    }),
    paths: {
      base: '/finance',
    },
  },
};

export default config;
