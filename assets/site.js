function setActiveNav() {
  const path = window.location.pathname.replace(/\/+$/, "");
  document.querySelectorAll("[data-nav]").forEach(a => {
    const href = a.getAttribute("href").replace(/\/+$/, "");
    if (!href) return;
    // Match end of path for relative links
    if (path.endsWith(href.replace("./","").replace("../",""))) a.classList.add("active");
  });
}

async function loadJSON(url) {
  const res = await fetch(url, {cache: "no-cache"});
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

function el(tag, attrs={}, children=[]) {
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

document.addEventListener("DOMContentLoaded", setActiveNav);
