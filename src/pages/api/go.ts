import type { APIRoute } from 'astro';

export const prerender = false;

const VALID_PLATFORMS = new Set(['steam', 'psn', 'xbox', 'kakao', 'stadia']);

export const GET: APIRoute = ({ url, redirect }) => {
  const name = (url.searchParams.get('name') ?? '').trim();
  const platformRaw = (url.searchParams.get('platform') ?? 'steam').trim().toLowerCase();
  const platform = VALID_PLATFORMS.has(platformRaw) ? platformRaw : 'steam';

  if (!name) {
    return redirect('/?error=not_found');
  }

  return redirect(`/r/${platform}/${encodeURIComponent(name)}`);
};
