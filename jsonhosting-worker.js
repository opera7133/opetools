export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Edit-Key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Proxy destination
    const targetUrl = new URL(url.pathname + url.search, "https://jsonhosting.com");

    // Copy request headers to pass along
    const headers = new Headers(request.headers);
    headers.delete("Origin");
    headers.delete("Referer");

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined,
      });

      // Wrap response to add CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
