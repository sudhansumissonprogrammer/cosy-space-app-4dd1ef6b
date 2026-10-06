// JD Store Spy — background service worker
// Role: proxies all platform API calls so the content script bypasses the
// storefront's CORS restrictions, and detects whether the active tab is a
// JD-hosted store (even on a custom domain).

const API_BASE = "https://byeetjlpwzpy.jdwebnship.in/api";
const API_KEY = "9e5a4f4b49da226ab3b1bc396020bf831cb3c14584ced963";

async function jd(path, origin, { method = "GET", body } = {}) {
  const url = `${API_BASE}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method,
    headers: {
      "API-KEY": API_KEY,
      "Origin": origin,
      "Referer": origin + "/",
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, body: json || text };
}

// --- store directory (bundled 1,020 known JD stores) ---
let DIRECTORY = null;
async function directory() {
  if (DIRECTORY) return DIRECTORY;
  const url = chrome.runtime.getURL("stores.json");
  DIRECTORY = await (await fetch(url)).json();
  return DIRECTORY;
}

// Is the given origin a JD-hosted store? Decide by hitting /home/shell;
// JD responds { data: { storeinfo: ... } } for every tenant and 4xx otherwise.
async function detectJd(origin) {
  try {
    const r = await jd("home/shell", origin);
    if (r.ok && r.body?.data?.storeinfo?.store_name) return r.body.data.storeinfo;
  } catch {}
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  (async () => {
    try {
      if (msg.type === "jd") {
        send(await jd(msg.path, msg.origin, { method: msg.method, body: msg.body }));
      } else if (msg.type === "detect") {
        send(await detectJd(msg.origin));
      } else if (msg.type === "directory") {
        send(await directory());
      } else {
        send({ error: "unknown message" });
      }
    } catch (e) {
      send({ error: String(e?.message || e) });
    }
  })();
  return true;
});
