import { createLightbox } from "./lightbox.js";

/* ------------------------------
   Base path helper for GitHub Pages
   - Works for: https://<user>.github.io/<repo>/...
   - Works for: http://localhost:8000/...
   - Avoid file:// (fetch + root paths will break)
--------------------------------- */
const BASE_PATH = (() => {
  const host = window.location.hostname || "";
  const isGitHubIO = host.endsWith("github.io");
  if (!isGitHubIO) return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  // For project pages: first segment is repo name
  return parts.length ? `/${parts[0]}` : "";
})();

function withBase(url) {
  if (!url) return "";
  const u = String(url);

  // external url
  if (/^https?:\/\//i.test(u)) return u;

  // already has base
  if (BASE_PATH && u.startsWith(BASE_PATH + "/")) return u;

  // root-absolute (/generated/..., /projects/...)
  if (u.startsWith("/")) return BASE_PATH + u;

  // relative (generated/..., projects/...)
  return BASE_PATH + "/" + u.replace(/^\.\//, "");
}

function safeText(v) {
  return (v ?? "").toString().trim();
}

function statusClass(status) {
  const s = (status || "").toLowerCase().trim();
  if (!s) return "";
  return s.replace(/\s+/g, "-"); // "In Progress" -> "in-progress"
}

function hasPhaseContent(phase) {
  if (!phase) return false;
  const imgs = phase.images || [];
  const vids = phase.videos || [];
  return imgs.length > 0 || vids.length > 0;
}

function hasOverviewContent(p) {
  return !!(
    p.location ||
    p.date ||
    p.projectType ||
    p.scope ||
    p.client ||
    p.status ||
    p.buildingArea ||
    p.notes ||
    p.summary
  );
}

function buildProjectCard(p) {
  const mediaUrl = `projects/${p.slug}/?tab=all`;
  const overviewUrl = `projects/${p.slug}/?tab=overview`;

  const card = document.createElement("div");
  card.className = "card project-card";

  // ✅ status 角标（Completed / In Progress）
  const sc = statusClass(p.status);
  if (sc) card.classList.add("status-" + sc);

  // Cover image → media(all)
  const coverLink = document.createElement("a");
  coverLink.href = withBase(mediaUrl);
  coverLink.style.display = "block";
  coverLink.style.position = "relative"; // for flag positioning

  const img = document.createElement("img");
  img.className = "project-thumb";
  img.loading = "lazy";
  img.alt = p.title || p.slug;
  img.src = withBase(p.coverThumb || "");
  coverLink.appendChild(img);

  // status flag on cover
  if (p.status) {
    const flag = document.createElement("div");
    flag.className = `status-flag ${statusClass(p.status)}`;
    flag.textContent = p.status;
    coverLink.appendChild(flag);
  }

  card.appendChild(coverLink);

  const body = document.createElement("div");
  body.className = "project-body";

  // ✅ Title + Detail 同一行（不孤零零）
  const row = document.createElement("div");
  row.className = "card-row";

  // Title → overview
  const titleLink = document.createElement("a");
  titleLink.href = withBase(overviewUrl);
  titleLink.className = "title title-link";
  titleLink.textContent = p.title || p.slug;

  // Detail button → media(all)
  const detail = document.createElement("a");
  detail.className = "btn secondary btn-detail";
  detail.href = withBase(mediaUrl);
  detail.textContent = "Detail";

  row.appendChild(titleLink);
  row.appendChild(detail);

  body.appendChild(row);
  card.appendChild(body);

  return card;
}

async function renderHome() {
  const mount = document.querySelector("#projectsGrid");
  if (!mount) return;

  const dataUrl =
    document.body.getAttribute("data-gallery-url") || "generated/gallery.json";

  // ✅ 让 gallery.json 也适配 GitHub Pages 子路径
  const res = await fetch(withBase(dataUrl), { cache: "no-cache" });
  if (!res.ok) {
    mount.innerHTML = `<div class="card" style="padding:16px;color:var(--muted)">Failed to load ${dataUrl}</div>`;
    return;
  }
  const data = await res.json();
  const projects = (data.projects || [])
    .slice()
    .sort((a, b) => (b.sortKey || "").localeCompare(a.sortKey || ""));

  mount.innerHTML = "";
  if (!projects.length) {
    mount.appendChild(
      Object.assign(document.createElement("div"), {
        className: "card",
        innerHTML:
          '<div style="padding:16px;color:var(--muted)">还没有项目。把照片放进 <code>projects/&lt;slug&gt;/before|during|after</code>，然后运行 <code>python3 tools/build.py</code> 生成索引。</div>',
      })
    );
    return;
  }
  for (const p of projects) mount.appendChild(buildProjectCard(p));
}

function buildInfoItem(k, v) {
  const li = document.createElement("li");
  li.className = "info-item";
  const key = document.createElement("div");
  key.className = "info-key";
  key.textContent = k;
  const val = document.createElement("div");
  val.className = "info-val";
  val.textContent = v;
  li.appendChild(key);
  li.appendChild(val);
  return li;
}

function renderPhase(phaseKey, phaseTitle, phase, lb) {
  if (!phase) return null;
  const images = phase.images || [];
  const videos = phase.videos || [];
  if (!images.length && !videos.length) return null;

  const wrap = document.createElement("section");
  wrap.className = "gallery-section";
  wrap.dataset.phase = phaseKey;

  const h2 = document.createElement("h2");
  h2.textContent = phaseTitle;
  wrap.appendChild(h2);

  if (videos.length) {
    const vw = document.createElement("div");
    vw.className = "video-wrap";
    for (const v of videos) {
      const card = document.createElement("div");
      card.className = "video card";

      if (v.kind === "embed" && v.url) {
        const iframe = document.createElement("iframe");
        iframe.loading = "lazy";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.src = v.url; // embed 本身是外链，不需要 withBase
        card.appendChild(iframe);
      } else if (v.kind === "file" && v.url) {
        const video = document.createElement("video");
        video.controls = true;
        video.preload = "metadata";
        video.src = withBase(v.url);
        card.appendChild(video);
      }
      vw.appendChild(card);
    }
    wrap.appendChild(vw);
  }

  if (images.length) {
    const grid = document.createElement("div");
    grid.className = "thumb-grid";

    // ✅ 预处理一份带 base 的 images，给 lightbox 用
    const fixedImages = images.map((x) => ({
      ...x,
      srcThumb: withBase(x.srcThumb),
      srcLarge: withBase(x.srcLarge),
    }));

    fixedImages.forEach((img, i) => {
      const t = document.createElement("img");
      t.className = "thumb";
      t.loading = "lazy";
      t.src = img.srcThumb;
      t.alt = img.alt || "";
      t.addEventListener("click", () => lb.open(fixedImages, i));
      grid.appendChild(t);
    });

    wrap.appendChild(grid);
  }

  return wrap;
}

async function renderProject() {
  const mount = document.querySelector("#projectMount");
  if (!mount) return;

  const slug = document.body.getAttribute("data-project-slug");
  const dataUrl = document.body.getAttribute("data-gallery-url");

  const res = await fetch(withBase(dataUrl), { cache: "no-cache" });
  if (!res.ok) {
    mount.innerHTML = `<div class="card" style="padding:16px;color:var(--muted)">Failed to load ${dataUrl}</div>`;
    return;
  }
  const data = await res.json();

  const p = (data.projects || []).find((x) => x.slug === slug);
  if (!p) {
    mount.innerHTML = `<div class="card" style="padding:16px;color:var(--muted)">未找到项目：${slug}</div>`;
    return;
  }

  // Title + status badge
  const titleEl = document.querySelector("#projectTitle");
  titleEl.textContent = p.title || slug;

  // Create status badge (colored) next to title; click => overview
  const oldBadge = document.querySelector("#statusBadge");
  if (oldBadge) oldBadge.remove();

  if (p.status) {
    const badge = document.createElement("span");
    badge.id = "statusBadge";
    badge.className = `badge status ${statusClass(p.status)}`;
    badge.textContent = p.status;
    badge.style.marginLeft = "12px";
    badge.style.cursor = "pointer";
    badge.title = "View overview";
    titleEl.appendChild(badge);
  }

  const subtitle = document.querySelector("#projectSubtitle");
  if (subtitle) {
    subtitle.textContent = "";
    subtitle.style.display = "none";
  }

  // Overview content
  const overviewWrap = document.querySelector("#overviewSection");
  const infoList = document.querySelector("#infoList");
  overviewWrap.innerHTML = "";

  // Left: field list
  infoList.innerHTML = "";
  const fields = [
    ["Location", safeText(p.location)],
    ["Date", safeText(p.date)],
    ["Project Type", safeText(p.projectType)],
    ["Scope", safeText(p.scope)],
    ["Summary", safeText(p.summary)],
    ["Notes", safeText(p.notes)],
    ["Client", safeText(p.client)],
    ["Status", safeText(p.status)],
    ["Building Area", safeText(p.buildingArea)],
  ];
  for (const [k, v] of fields) {
    if (!v) continue;
    infoList.appendChild(buildInfoItem(k, v));
  }
  if (!infoList.children.length) {
    infoList.appendChild(buildInfoItem("Info", "No details provided yet."));
  }

  // Lightbox
  const lb = createLightbox();

  // Build media sections
  const gs = document.querySelector("#gallerySections");
  gs.innerHTML = "";
  const secRenderings = renderPhase(
    "renderings",
    "Renderings",
    p.phases?.renderings,
    lb
  );
  const secBefore = renderPhase("before", "Before", p.phases?.before, lb);
  const secDuring = renderPhase("during", "During", p.phases?.during, lb);
  const secAfter = renderPhase("after", "After", p.phases?.after, lb);

  const sections = [secRenderings, secBefore, secDuring, secAfter].filter(
    Boolean
  );
  if (!sections.length) {
    gs.appendChild(
      Object.assign(document.createElement("div"), {
        className: "card",
        innerHTML:
          '<div style="padding:16px;color:var(--muted)">这个项目还没有媒体内容。把照片放进该项目的 before/during/after 文件夹后再运行构建脚本即可。</div>',
      })
    );
  } else {
    sections.forEach((s) => gs.appendChild(s));
  }

  // Tabs: show only what exists
  const tabs = document.querySelector("#tabs");
  tabs.innerHTML = "";

  const tabList = [];
  if (hasOverviewContent(p)) tabList.push(["overview", "Overview"]);
  const anyMedia =
    hasPhaseContent(p.phases?.renderings) ||
    hasPhaseContent(p.phases?.before) ||
    hasPhaseContent(p.phases?.during) ||
    hasPhaseContent(p.phases?.after);

  if (anyMedia) tabList.push(["all", "All"]);
  if (hasPhaseContent(p.phases?.renderings))
    tabList.push(["renderings", "Renderings"]);
  if (hasPhaseContent(p.phases?.before)) tabList.push(["before", "Before"]);
  if (hasPhaseContent(p.phases?.during)) tabList.push(["during", "During"]);
  if (hasPhaseContent(p.phases?.after)) tabList.push(["after", "After"]);

  function setActive(tab) {
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

  function showOverview(on) {
    const block = document.querySelector("#overviewBlock");
    if (!block) return;
    block.classList.toggle("hidden", !on);
  }

  function showMediaAll(on) {
    document
      .querySelectorAll("#gallerySections .gallery-section")
      .forEach((sec) => {
        sec.classList.toggle("hidden", !on);
      });
  }

  function showOnlyPhase(phaseKey) {
    document
      .querySelectorAll("#gallerySections .gallery-section")
      .forEach((sec) => {
        sec.classList.toggle("hidden", sec.dataset.phase !== phaseKey);
      });
  }

  function switchTab(tab) {
    setActive(tab);

    if (tab === "overview") {
      showOverview(true);
      showMediaAll(false);
      document
        .querySelectorAll("#gallerySections .gallery-section")
        .forEach((sec) => sec.classList.add("hidden"));
      return;
    }

    showOverview(false);

    if (tab === "all") {
      showMediaAll(true);
      return;
    }

    showOnlyPhase(tab);
  }

  // Create buttons
  for (const [key, label] of tabList) {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.tab = key;
    btn.textContent = label;
    btn.addEventListener("click", () => switchTab(key));
    tabs.appendChild(btn);
  }

  // Title and status badge click => overview
  const badge = document.querySelector("#statusBadge");
  if (badge) {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      if (tabList.some((t) => t[0] === "overview")) switchTab("overview");
    });
  }
  titleEl.style.cursor = "pointer";
  titleEl.title = "View overview";
  titleEl.addEventListener("click", () => {
    if (tabList.some((t) => t[0] === "overview")) switchTab("overview");
  });

  // Default tab by URL param
  const params = new URLSearchParams(window.location.search);
  const want = (params.get("tab") || "").toLowerCase();

  const available = new Set(tabList.map((t) => t[0]));
  let defaultTab = tabList.length ? tabList[0][0] : "overview";

  if (want === "overview" && available.has("overview")) defaultTab = "overview";
  else if ((want === "all" || want === "media") && available.has("all"))
    defaultTab = "all";
  else if (available.has(want)) defaultTab = want;

  if (!available.has(defaultTab) && available.has("all")) defaultTab = "all";

  switchTab(defaultTab);
}

document.addEventListener("DOMContentLoaded", async () => {
  await renderHome();
  await renderProject();
});