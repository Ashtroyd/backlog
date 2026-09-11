/** Isolated browser-review fixtures. Never connects to a real Supabase project.
 * Run: node tests/support/review-server.mjs
 * Then: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 NEXT_PUBLIC_SUPABASE_ANON_KEY=review-only npm run dev -- --port 3100
 * Browse http://127.0.0.1:3102; sign in with reviewer@example.test / review-only.
 */
import http from "node:http";
import net from "node:net";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "reviewer@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const profile = {
  ...user,
  username: "reviewer",
  display_name: "Review",
  avatar_url: null,
  banner_url: null,
  bio: null,
  home_layout: null,
};
const base = {
  user_id: user.id,
  cover_url: null,
  release_year: 2024,
  genres: ["Adventure"],
  meta: { _refreshedAt: new Date().toISOString() },
  status: "in_progress",
  rating: null,
  review: null,
  is_private: false,
  is_favorite: false,
  started_at: "2026-08-01",
  progress: null,
  hours_played: null,
  notes: null,
  pinned_at: null,
  live_service: false,
  current_thoughts: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
};
let items = [
  {
    ...base,
    id: "anime-1",
    external_id: "21",
    media_type: "anime",
    title: "One Piece",
    progress: 500,
  },
  {
    ...base,
    id: "anime-2",
    external_id: "52991",
    media_type: "anime",
    title: "Frieren",
    progress: 12,
    meta: { ...base.meta, episodes: 28 },
  },
  {
    ...base,
    id: "game-1",
    external_id: "1",
    media_type: "game",
    title: "Beast of Reincarnation",
    hours_played: 8,
  },
  {
    ...base,
    id: "game-2",
    external_id: "2",
    media_type: "game",
    title: "Valorant",
    live_service: true,
    hours_played: 120,
  },
  {
    ...base,
    id: "game-3",
    external_id: "3",
    media_type: "game",
    title: "THE FINALS PLAYTEST",
    live_service: true,
  },
  {
    ...base,
    id: "game-4",
    external_id: "4",
    media_type: "game",
    title: "Firewatch",
    status: "completed",
    rating: 5,
    review:
      "A short game with a beautiful setting and a story that stayed with me. The quiet conversations and changing light made this a memorable evening.",
  },
  {
    ...base,
    id: "game-5",
    external_id: "5",
    media_type: "game",
    title: "3DMark",
    status: "backlog",
  },
];
let failNext = false;
const writes = [];
function json(res, data, code = 200) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
    "Access-Control-Expose-Headers": "Content-Range",
    "Content-Range": "0-0/1",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let text = "";
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}
function matches(row, params) {
  for (const [key, filter] of params) {
    if (["select", "order", "limit", "or", "offset"].includes(key)) continue;
    if (filter.startsWith("eq.") && String(row[key]) !== filter.slice(3))
      return false;
    if (filter.startsWith("neq.") && String(row[key]) === filter.slice(4))
      return false;
    if (
      filter.startsWith("in.(") &&
      !filter.slice(4, -1).split(",").includes(String(row[key]))
    )
      return false;
  }
  return true;
}
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "OPTIONS") return json(res, {});
    if (url.pathname === "/__review/fail-next" && req.method === "POST") {
      failNext = true;
      return json(res, { ready: true });
    }
    if (url.pathname === "/__review/state") return json(res, { items, writes });
    if (url.pathname.startsWith("/auth/v1/token")) {
      const encode = (v) =>
        Buffer.from(JSON.stringify(v)).toString("base64url");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.review`;
      return json(res, {
        access_token: token,
        refresh_token: "review-only",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    }
    if (url.pathname === "/auth/v1/user") return json(res, user);
    if (url.pathname === "/rest/v1/profiles")
      return json(
        res,
        req.headers.accept?.includes("object") ? profile : [profile],
      );
    if (url.pathname === "/rest/v1/items") {
      const matched = items.filter((i) => matches(i, url.searchParams));
      if (req.method === "HEAD") return json(res, null);
      if (req.method === "PATCH") {
        const patch = await body(req);
        if (failNext) {
          failNext = false;
          return json(
            res,
            { message: "Simulated save failure", code: "REVIEW" },
            503,
          );
        }
        writes.push({ method: "PATCH", ids: matched.map((i) => i.id), patch });
        for (const item of matched) Object.assign(item, patch);
        return json(
          res,
          req.headers.accept?.includes("object") ? matched[0] : matched,
        );
      }
      if (req.method === "POST") {
        const rows = await body(req);
        items.push(...(Array.isArray(rows) ? rows : [rows]));
        writes.push({ method: "POST", rows });
        return json(res, rows, 201);
      }
      if (req.method === "DELETE") {
        items = items.filter((i) => !matched.includes(i));
        return json(res, []);
      }
      let data = matched;
      if (url.searchParams.has("or"))
        data = data.filter((i) => i.review || i.current_thoughts);
      if (url.searchParams.has("limit"))
        data = data.slice(0, Number(url.searchParams.get("limit")));
      return json(
        res,
        req.headers.accept?.includes("object") ? (data[0] ?? null) : data,
      );
    }
    return json(res, []);
  })
  .listen(3101, "127.0.0.1", () =>
    console.log("Review data: http://127.0.0.1:3101"),
  );
const proxy = http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/import/steam"))
      return json(res, {
        results: [
          {
            appid: "new-1",
            name: "New Adventure",
            hoursPlayed: 10,
            coverUrl: null,
          },
          { appid: "new-2", name: "3DMark", hoursPlayed: 2, coverUrl: null },
          {
            appid: "new-3",
            name: "New Adventure Playtest",
            hoursPlayed: 3,
            coverUrl: null,
          },
          { appid: "new-4", name: "Firewatch", hoursPlayed: 4, coverUrl: null },
        ],
      });
    if (req.url.startsWith("/api/refresh"))
      return json(res, {
        result: { year: 2024, genres: ["Adventure"], meta: {} },
      });
    if (req.url.startsWith("/api/trending")) return json(res, { results: [] });
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3100,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("Start the Next.js server on port 3100.");
    });
    req.pipe(upstream);
  })
  .listen(3102, "127.0.0.1", () =>
    console.log("Review app: http://127.0.0.1:3102"),
  );

proxy.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(3100, "127.0.0.1", () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
