const RACE_FEEDS = {
  wec: {
    publisher: 'Autosport.com',
    url: 'https://www.autosport.com/rss/feed/wec',
  },
  imsa: {
    publisher: 'Autosport.com',
    url: 'https://www.autosport.com/rss/feed/imsa',
  },
  wrc: {
    publisher: 'Autosport.com',
    url: 'https://www.autosport.com/rss/feed/wrc',
  },
  rally: {
    publisher: 'DirtFish',
    url: 'https://dirtfish.com/feed/',
  },
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  const series = (url.searchParams.get('series') || 'wec').toLowerCase();
  const feed = RACE_FEEDS[series];

  if (!feed) {
    return Response.json(
      { detail: `Unknown series "${series}". Supported series: ${Object.keys(RACE_FEEDS).join(', ')}` },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const upstream = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NERV-Terminal/1.0; +https://nervesite.netlify.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      return Response.json(
        { detail: `Upstream publisher returned status ${upstream.status}.` },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const xml = await upstream.text();
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return Response.json(
      { detail: isTimeout ? 'Upstream request timed out.' : 'Failed to reach feed publisher.' },
      { status: 504, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
