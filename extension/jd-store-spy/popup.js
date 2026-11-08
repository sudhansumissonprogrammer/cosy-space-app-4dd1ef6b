(async () => {
  const dir = await new Promise((r) => chrome.runtime.sendMessage({ type: "directory" }, r));
  const q = document.getElementById("q"), r = document.getElementById("r");
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const list = s ? dir.filter((x) => x.host.includes(s) || (x.name || "").toLowerCase().includes(s) || (x.phone || "").includes(s)).slice(0, 25) : dir.slice(0, 25);
    r.innerHTML = list.map((x) => `<div style="padding:6px 0;border-bottom:1px solid #111827">
      <a href="https://${x.host}" target="_blank" style="color:#fbbf24;font-weight:500">${x.name || x.slug}</a>
      <div style="color:#6b7280;font-size:11px">${x.host}${x.phone ? " · " + x.phone : ""}</div></div>`).join("") || '<div style="color:#6b7280;padding:20px 0;text-align:center">No match</div>';
  };
  q.addEventListener("input", draw); draw();
})();
