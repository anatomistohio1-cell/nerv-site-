export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json(
      { detail: 'Method not allowed' },
      { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const relayUrl = process.env.NERV_RELAY_URL || process.env.RELAY_URL;
  if (!relayUrl) {
    return Response.json(
      {
        status: "ok",
        devices: [],
        cpu_percent: 0,
        memory_percent: 0,
        detail: 'Cloud relay is not configured in Netlify. Connect via local Wi-Fi.',
      },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const { access_token, path, body } = await req.json();
    if (!access_token || !path) {
      return Response.json(
        { detail: 'Missing required fields: access_token and path.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const targetUrl = `${relayUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(targetUrl, {
      method: body && Object.keys(body).length > 0 ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      ...(body && Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();
    return Response.json(data, {
      status: response.status,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return Response.json(
      { detail: `Relay communication error: ${error.message}` },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
