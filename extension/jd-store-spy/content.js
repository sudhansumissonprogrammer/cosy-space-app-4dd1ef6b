// JD Store Spy — injected on any JD-hosted store page.
// Builds a floating insights panel using only public endpoints the store itself
// calls. Order counts are NOT public anywhere on the JD platform, so the
// "top sellers" ranking is an estimate from signals the user can verify (date
// added, featured placement, discount depth, photo/video richness, number of
// product pages). This matches how Shopify spy tools (Koala Inspector, PPSPY)
// work.

(() => {
  if (window.__jdSpyLoaded) return;
  window.__jdSpyLoaded = true;

  const origin = location.origin;
  const call = (type, payload) => new Promise((r) => chrome.runtime.sendMessage({ type, origin, ...payload }, r));

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === "html") n.innerHTML = attrs[k];
      else if (k === "on") for (const e in attrs[k]) n.addEventListener(e, attrs[k][e]);
      else n.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => c && n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const img = (p) => (p ? (p.startsWith("http") ? p : `https://assets.jdwebnship.in/${p}`) : "");
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const days = (iso) => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null;

  const state = {
    info: null, flags: null, categories: [], products: [],
    featuredIds: new Set(), newArrivalIds: new Set(),
    walking: false, dir: null,
  };

  async function detect() {
    const info = await call("detect", {});
    if (!info) return null;
    state.info = info;
    return info;
  }

  async function loadBasics() {
    const [flags, cats, feat, newa] = await Promise.all([
      call("jd", { path: "home/flags" }),
      call("jd", { path: "products/categories" }),
      call("jd", { path: "products/v2/featured" }),
      call("jd", { path: "products/v2/new-arraivals" }),
    ]);
    state.flags = flags.body?.data?.flags || {};
    state.categories = cats.body?.data?.sub_categories || [];
    (feat.body?.data || []).forEach((p) => state.featuredIds.add(p.id));
    (newa.body?.data || []).forEach((p) => state.newArrivalIds.add(p.id));
  }

  // Walk recently-added pages until empty or budget hit. The listing is 12/page
  // sorted newest-first — this is how the storefront itself paginates. We stop
  // early for a quick overview and let the user press "Load more" for depth.
  async function walkPages(maxPages = 10) {
    state.walking = true; render();
    for (let page = 1; page <= maxPages; page++) {
      const r = await call("jd", { path: `products/v2/retailer/recent?sortBy=recently_added&page=${page}` });
      const list = r.body?.data || [];
      if (!list.length) break;
      // dedupe by id
      const have = new Set(state.products.map((x) => x.id));
      list.forEach((p) => !have.has(p.id) && state.products.push(p));
      render();
    }
    // Fetch created_at + photo count only for the first ~40 unknowns (quota-friendly).
    const unknown = state.products.filter((p) => !p.__detail).slice(0, 40);
    for (const p of unknown) {
      const r = await call("jd", { path: `products/v2/detail/${encodeURIComponent(p.id)}` });
      const d = r.body?.data;
      if (d) {
        p.__detail = true;
        p.created_at = d.created_at;
        p.image_count = (d.images || []).length;
        p.has_video = !!d.video;
        p.in_stock = !!d.in_stock;
      }
    }
    state.walking = false; render();
  }

  // Estimated score. Clearly labeled in the UI as an estimate. Signals:
  // - still in stock after many days (persistent demand)
  // - owner featured it (owner's own best-seller signal)
  // - deep discount (clearance = moving stock)
  // - rich media (owner invested in the listing)
  // - still on page 1 of recently-added (fresh and front-of-store)
  function score(p, idx) {
    let s = 0;
    const d = days(p.created_at);
    if (d != null) {
      if (d >= 30 && p.in_stock !== false) s += 40;
      else if (d >= 14) s += 25;
      else if (d >= 7) s += 15;
      else s += 5;
    }
    if (state.featuredIds.has(p.id)) s += 30;
    if (p.image_count >= 4) s += 10;
    if (p.has_video) s += 15;
    const price = Number(p.final_price || p.price || 0);
    const mrp = Number(p.old_price || 0);
    if (mrp && price && mrp > price) {
      const off = Math.round(((mrp - price) / mrp) * 100);
      if (off >= 50) s += 20;
      else if (off >= 30) s += 10;
    }
    if (p.in_stock === false) s -= 20;
    s += Math.max(0, 20 - idx); // position in recently-added
    return s;
  }

  function label(p) {
    const d = days(p.created_at);
    if (p.in_stock === false) return { t: "Out of stock", c: "warn" };
    if (state.featuredIds.has(p.id)) return { t: "Likely top seller", c: "hot" };
    if (d != null && d >= 30) return { t: "Running " + d + "d", c: "good" };
    if (d != null && d < 7) return { t: "New", c: "" };
    return { t: "", c: "" };
  }

  // --- rendering ---
  let tab = "top";
  let root;

  function render() {
    if (!root) return;
    const body = root.querySelector("#jdspy-body");
    const info = state.info || {};
    const sub = (info.subdomain_v2 || info.subdomain || "").replace(/^https?:\/\//, "");

    // overview
    const dates = state.products.filter((p) => p.created_at).map((p) => new Date(p.created_at).getTime());
    const oldest = dates.length ? new Date(Math.min(...dates)) : null;
    const storeAge = oldest ? Math.floor((Date.now() - oldest.getTime()) / 86400000) : null;
    const outCount = state.products.filter((p) => p.in_stock === false).length;

    const topHtml = () => {
      if (!state.products.length) return `<div class="empty">${state.walking ? "Loading catalog…" : "No products yet"}</div>`;
      const ranked = state.products.map((p, i) => ({ p, s: score(p, i) })).sort((a, b) => b.s - a.s).slice(0, 30);
      return ranked.map(({ p, s }) => {
        const l = label(p);
        return `<div class="row">
          <img src="${esc(img(p.cover_image))}" onerror="this.style.visibility='hidden'">
          <div class="meta">
            <div class="name">${esc(p.name || "")}</div>
            <div class="sub">${inr(p.final_price || p.price)}${p.old_price && p.old_price > (p.final_price || p.price) ? ' <span style="text-decoration:line-through;color:#4b5563">' + inr(p.old_price) + "</span>" : ""} ${l.t ? `<span class="pill ${l.c}">${esc(l.t)}</span>` : ""}</div>
          </div>
          <div class="score">${s}</div>
        </div>`;
      }).join("");
    };

    const allHtml = () => {
      if (!state.products.length) return `<div class="empty">${state.walking ? "Loading…" : "Press Load catalog"}</div>`;
      return state.products.map((p) => `<div class="row">
        <img src="${esc(img(p.cover_image))}" onerror="this.style.visibility='hidden'">
        <div class="meta"><div class="name">${esc(p.name || "")}</div>
          <div class="sub">${inr(p.final_price || p.price)}${p.created_at ? " · " + days(p.created_at) + "d ago" : ""}${p.in_stock === false ? " · <span style=\"color:#fca5a5\">out</span>" : ""}</div>
        </div></div>`).join("");
    };

    const dirHtml = () => {
      const q = (root.querySelector("#jdspy-search")?.value || "").trim().toLowerCase();
      if (!state.dir) return `<div class="empty">Loading directory…</div>`;
      let list = state.dir;
      if (q) list = list.filter((s) => s.host.includes(q) || s.name.toLowerCase().includes(q) || (s.phone || "").includes(q));
      return `<div style="color:#9ca3af;font-size:11px;margin:4px 0 8px">${list.length} / ${state.dir.length} stores</div>` +
        list.slice(0, 120).map((s) => `<div class="row">
          <div class="meta"><div class="name">${esc(s.name || s.slug)}</div>
            <div class="sub"><a href="https://${esc(s.host)}" target="_blank">${esc(s.host)}</a>${s.phone ? " · " + esc(s.phone) : ""}</div></div>
        </div>`).join("");
    };

    const panels = {
      top: `
        <div class="toast"><b>Estimate.</b> Real order counts are not public on JD stores. This rank combines days-live, featured placement, discount depth, media richness and position. Verify before relying.</div>
        ${topHtml()}
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn ghost" id="jdspy-more">Load more pages</button>
          <button class="btn" id="jdspy-export">Export CSV</button>
        </div>`,
      overview: `
        <div class="kv">
          <b>Store</b><span>${esc(info.store_name || "")}</span>
          <b>Subdomain</b><span>${esc(sub)}</span>
          <b>Phone</b><span>${esc(info.mobile_no || "—")}</span>
          <b>Email</b><span>${esc(info.email || "—")}</span>
          <b>Role</b><span>${info.is_retailer ? "Retailer" : "Wholesaler"}</span>
          <b>Theme</b><span>#${esc(info.theme_id || "?")}</span>
          <b>Pixel ID</b><span>${info.facebook_pixel_id ? '<span class="pill good">' + esc(info.facebook_pixel_id) + "</span>" : "—"}</span>
          <b>GA ID</b><span>${info.google_analytics_id ? '<span class="pill good">' + esc(info.google_analytics_id) + "</span>" : "—"}</span>
          <b>Prepaid</b><span>${state.flags?.prepaid_option ? '<span class="pill good">on</span>' : "off"}</span>
          <b>Gateway</b><span>${state.flags?.use_gateway ? '<span class="pill good">on</span>' : "off"}</span>
          <b>Reviews</b><span>${state.flags?.product_reviews_enabled ? '<span class="pill good">on</span>' : "off"}</span>
          <b>Store age</b><span>${storeAge != null ? storeAge + " days" : "unknown"}</span>
          <b>Products loaded</b><span>${state.products.length}${outCount ? " · " + outCount + " out of stock" : ""}</span>
          <b>Categories</b><span>${state.categories.length}</span>
          <b>Featured count</b><span>${state.featuredIds.size}</span>
        </div>
        <h4>Why this matters</h4>
        <div class="toast">Pixel/GA on = owner is tracking ads. Prepaid off = COD-only. Reviews off = no social proof. These signals usually matter more than product count.</div>`,
      directory: `
        <input id="jdspy-search" placeholder="Search ${state.dir ? state.dir.length : "1,000+"} JD stores — name, host, phone">
        <div id="jdspy-dir">${dirHtml()}</div>`,
      all: allHtml(),
    };
    body.innerHTML = `
      <div class="tabs">
        <button data-t="top" class="${tab === "top" ? "on" : ""}">Top</button>
        <button data-t="overview" class="${tab === "overview" ? "on" : ""}">Store</button>
        <button data-t="all" class="${tab === "all" ? "on" : ""}">Catalog</button>
        <button data-t="directory" class="${tab === "directory" ? "on" : ""}">Directory</button>
      </div>
      <div style="margin-top:10px">${panels[tab]}</div>`;
    body.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", async () => {
      tab = b.dataset.t;
      if (tab === "directory" && !state.dir) state.dir = await call("directory", {});
      render();
    }));
    const more = body.querySelector("#jdspy-more");
    if (more) more.addEventListener("click", () => walkPages(30));
    const exp = body.querySelector("#jdspy-export");
    if (exp) exp.addEventListener("click", exportCsv);
    const srch = body.querySelector("#jdspy-search");
    if (srch) srch.addEventListener("input", () => {
      body.querySelector("#jdspy-dir").innerHTML = dirHtml();
    });
  }

  function exportCsv() {
    const rows = [["id", "name", "price", "mrp", "discount_pct", "created_at", "days_live", "in_stock", "featured", "images", "video", "score"]];
    state.products.map((p, i) => ({ p, s: score(p, i) })).sort((a, b) => b.s - a.s).forEach(({ p, s }) => {
      const price = Number(p.final_price || p.price || 0);
      const mrp = Number(p.old_price || 0);
      rows.push([
        p.id, p.name, price, mrp, mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
        p.created_at || "", days(p.created_at) ?? "", p.in_stock === false ? "no" : "yes",
        state.featuredIds.has(p.id) ? "yes" : "no", p.image_count || "", p.has_video ? "yes" : "no", s,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `jd-spy-${(state.info?.store_name || "store").replace(/\W+/g, "-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function mount() {
    root = el("div", { id: "jdspy-root" });
    root.innerHTML = `
      <header>
        <span class="t">JD Store Spy</span>
        <button id="jdspy-min" title="Minimize">—</button>
        <button id="jdspy-close" title="Close">×</button>
      </header>
      <div id="jdspy-body"><div class="empty">Loading…</div></div>`;
    document.documentElement.appendChild(root);
    root.querySelector("#jdspy-min").addEventListener("click", () => root.classList.toggle("min"));
    root.querySelector("#jdspy-close").addEventListener("click", () => root.remove());
    // drag
    const hdr = root.querySelector("header");
    let drag = null;
    hdr.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      const r = root.getBoundingClientRect();
      drag = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    addEventListener("mousemove", (e) => {
      if (!drag) return;
      root.style.left = e.clientX - drag.x + "px";
      root.style.top = e.clientY - drag.y + "px";
      root.style.right = "auto";
    });
    addEventListener("mouseup", () => (drag = null));
  }

  (async () => {
    const info = await detect();
    if (!info) return; // not a JD store
    mount();
    render();
    await loadBasics();
    await walkPages(5);
  })();
})();
