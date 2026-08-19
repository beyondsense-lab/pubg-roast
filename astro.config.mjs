import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: {
      enabled: true, // lets `astro dev` see your local D1 + secrets via .dev.vars / wrangler.toml
    },
  }),
});
