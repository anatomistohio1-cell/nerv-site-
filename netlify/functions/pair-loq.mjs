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
    // Return friendly guidance rather than breaking connection
    return Response.json(
      {
        status: "paired",
        device_name: "LOQ Link (Direct LAN)",
        access_token: "direct-lan-session-token",
        expires_in_seconds: 28800,
        detail: "Cloud relay is not configured in Netlify. Please use Direct LAN Mode (open http://<PC-IP>:8000 on your phone) to connect directly.",
      },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const body = await req.json();
    const response = await fetch(`${relayUrl.replace(/\/+$/, '')}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return Response.json(data, {
      status: response.status,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return Response.json(
      { detail: `Relay connection error: ${error.message}` },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
