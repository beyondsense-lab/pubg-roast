/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Env = {
  DB: D1Database;
  PUBG_API_KEY: string;
  CACHE_TTL_HOURS?: string;
  DEFAULT_PLATFORM?: string;
};

declare namespace App {
  interface Locals extends Runtime<Env> {}
}

type Runtime<T> = import('@astrojs/cloudflare').Runtime<T>;
