import http from "node:http";

const POSTGREST_PORT = 3001;
const PROXY_PORT = 54321;
const uploadedKeys = new Set();

const server = http.createServer((req, res) => {
  // Storage mock: respond with success for uploads, 409 for duplicates
  if (req.url?.startsWith("/storage/v1/object/")) {
    const key = req.url.replace("/storage/v1/object/", "");

    // DELETE: remove tracked keys
    // Supabase storage.remove() sends a JSON body: { prefixes: ["path1", "path2"] }
    if (req.method === "DELETE") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          // Handle both { prefixes: [...] } and plain array formats
          const paths = Array.isArray(parsed) ? parsed : parsed?.prefixes || [];
          for (const p of paths) uploadedKeys.delete(p);
        } catch {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      });
      return;
    }

    // GET (public URL): always succeed
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ publicUrl: `http://localhost:54321/storage/v1/object/public/${key}` }),
      );
      return;
    }

    // POST/PUT: track keys, reject duplicates
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
      res.writeHead(upstream.statusCode ?? 500, upstream.headers);
      upstream.pipe(res);
    });
    proxy.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("PostgREST proxy error: " + err.message);
    });
    req.pipe(proxy);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Test proxy listening on :${PROXY_PORT}`);
});
