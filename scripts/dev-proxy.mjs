import http from "node:http";

const POSTGREST_PORT = 3001;
const GOTRUE_PORT = 9999;
const PROXY_PORT = 54321;
const uploadedKeys = new Set();

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "x-supabase-api-version",
  "access-control-max-age": "86400",
};

// Strip any existing CORS headers from upstream, then apply ours
function withCors(upstreamHeaders) {
  const cleaned = {};
  for (const [k, v] of Object.entries(upstreamHeaders)) {
    if (!k.toLowerCase().startsWith("access-control-")) {
      cleaned[k] = v;
    }
  }
  return { ...cleaned, ...CORS_HEADERS };
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight for all routes
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Auth proxy: forward to GoTrue
  if (req.url?.startsWith("/auth/v1/")) {
    const target = req.url.replace("/auth/v1/", "/");
    const opts = {
      hostname: "127.0.0.1",
      port: GOTRUE_PORT,
      path: target,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${GOTRUE_PORT}` },
    };
    const proxy = http.request(opts, (upstream) => {
      const headers = withCors(upstream.headers);
      res.writeHead(upstream.statusCode ?? 500, headers);
      upstream.pipe(res);
    });
    proxy.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain", ...CORS_HEADERS });
      res.end("GoTrue proxy error: " + err.message);
    });
    req.pipe(proxy);
    return;
  }

  // Storage mock: respond with success for uploads, 409 for duplicates
  if (req.url?.startsWith("/storage/v1/object/")) {
    const key = req.url.replace("/storage/v1/object/", "");

    if (req.method === "DELETE") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const paths = Array.isArray(parsed) ? parsed : parsed?.prefixes || [];
          for (const p of paths) uploadedKeys.delete(p);
        } catch {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      });
      return;
    }

    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ publicUrl: `http://localhost:54321/storage/v1/object/public/${key}` }),
      );
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (uploadedKeys.has(key)) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            statusCode: "409",
            error: "Duplicate",
            message: "The resource already exists",
          }),
        );
        return;
      }
      uploadedKeys.add(key);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ Key: key }));
    });
    return;
  }

  // REST proxy: forward to PostgREST
  if (req.url?.startsWith("/rest/v1/")) {
    const target = req.url.replace("/rest/v1/", "/");
    const opts = {
      hostname: "127.0.0.1",
      port: POSTGREST_PORT,
      path: target,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${POSTGREST_PORT}` },
    };
    const proxy = http.request(opts, (upstream) => {
      const headers = withCors(upstream.headers);
      res.writeHead(upstream.statusCode ?? 500, headers);
      upstream.pipe(res);
    });
    proxy.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain", ...CORS_HEADERS });
      res.end("PostgREST proxy error: " + err.message);
    });
    req.pipe(proxy);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(
    `Dev proxy listening on :${PROXY_PORT} (auth → :${GOTRUE_PORT}, rest → :${POSTGREST_PORT})`,
  );
});
