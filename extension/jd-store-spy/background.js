// JD Store Spy — background service worker
// Only the bundled directory is available. API scanning is disabled because
// private platform credentials cannot be protected inside a browser extension.

// --- store directory (bundled 1,020 known JD stores) ---
let DIRECTORY = null;
async function directory() {
  if (DIRECTORY) return DIRECTORY;
  const url = chrome.runtime.getURL("stores.json");
  DIRECTORY = await (await fetch(url)).json();
  return DIRECTORY;
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  (async () => {
    try {
      if (msg.type === "directory") {
        send(await directory());
      } else {
        send({ error: "API scanning is disabled; no private credentials are bundled." });
      }
    } catch (e) {
      send({ error: String(e?.message || e) });
    }
  })();
  return true;
});
