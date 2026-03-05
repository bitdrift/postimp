import http from "node:http";

const POSTGREST_PORT = 3001;
const PROXY_PORT = 54321;

const server = http.createServer((req, res) => {
  // Storage mock: respond with success for uploads
  if (req.url?.startsWith("/storage/v1/object/")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ Key: req.url.replace("/storage/v1/object/", "") }));
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
