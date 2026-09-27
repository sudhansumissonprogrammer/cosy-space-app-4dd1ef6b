const STORAGE_KEY = "shopbanao_meesho_products_v1";
const statusEl = document.getElementById("status");
const productsEl = document.getElementById("products");
const countEl = document.getElementById("count");
const collectButton = document.getElementById("collect");
const exportButton = document.getElementById("export");
const clearButton = document.getElementById("clear");

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function save(products) {
  await chrome.storage.local.set({ [STORAGE_KEY]: products });
  render(products);
}

function render(products) {
  countEl.textContent = String(products.length);
  exportButton.disabled = products.length === 0;
  clearButton.disabled = products.length === 0;
  productsEl.textContent = "";
  products.forEach((product, index) => {
    const item = document.createElement("div");
    item.className = "item";
    const image = document.createElement("img");
    image.src = product.images?.[0] || "icon.png";
    image.alt = "";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = product.name || "Incomplete product";
    const detail = document.createElement("span");
    detail.textContent = product.missing?.length ? `Missing: ${product.missing.join(", ")}` : `₹${product.selling_price}`;
    copy.append(title, detail);
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.title = "Remove";
    remove.textContent = "×";
    remove.addEventListener("click", async () => {
      const current = await load();
      current.splice(index, 1);
      await save(current);
    });
    item.append(image, copy, remove);
    productsEl.append(item);
  });
}

collectButton.addEventListener("click", async () => {
  statusEl.textContent = "Reading this product…";
  collectButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found.");
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_MEESHO" });
    if (!response?.ok) throw new Error(response?.error || "Could not read this product.");
    const products = await load();
    const key = response.product.source_id || response.product.source_url;
    const existing = products.findIndex((item) => (item.source_id || item.source_url) === key);
    if (existing >= 0) products[existing] = response.product;
    else products.push(response.product);
    await save(products);
    statusEl.textContent = response.product.missing?.length
      ? `Saved for review. Missing: ${response.product.missing.join(", ")}.`
      : "Product saved. Open the next Meesho link and repeat.";
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : "Could not collect this product.";
  } finally {
    collectButton.disabled = false;
  }
});

exportButton.addEventListener("click", async () => {
  const products = await load();
  const payload = {
    format: "shopbanao-meesho-import",
    version: 1,
    exported_at: new Date().toISOString(),
    category: { name: "New2", slug: "new2" },
    products,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  await chrome.downloads.download({ url, filename: `shopbanao-meesho-${Date.now()}.json`, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  statusEl.textContent = "Import file downloaded.";
});

clearButton.addEventListener("click", async () => {
  if (!confirm("Remove every saved product from this extension?")) return;
  await save([]);
  statusEl.textContent = "Saved list cleared.";
});

load().then(render);