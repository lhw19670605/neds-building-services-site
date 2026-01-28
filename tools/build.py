#!/usr/bin/env python3
"""
Build assets for a photo-heavy static site:
- Generates thumbnails + large images from original photos
- Builds generated/gallery.json index
- Creates/updates project detail pages at projects/<slug>/index.html

Mac quick start:
  python3 -m pip install --upgrade pip
  python3 -m pip install pillow
  python3 tools/build.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import re

from PIL import Image, ImageOps

PHASES = ["renderings", "before", "during", "after"]
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
VID_EXTS = {".mp4", ".webm", ".mov"}

THUMB_MAX = 720   # px
LARGE_MAX = 2200  # px
JPG_QUALITY = 82

def slug_ok(s: str) -> bool:
  return re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", s) is not None

def resize_to_max(img: Image.Image, max_px: int) -> Image.Image:
  w, h = img.size
  m = max(w, h)
  if m <= max_px:
    return img
  scale = max_px / float(m)
  new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
  return img.resize(new_size, Image.Resampling.LANCZOS)

def to_jpg(img: Image.Image) -> Image.Image:
  if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
    bg = Image.new("RGB", img.size, (11,15,23))
    bg.paste(img, mask=img.split()[-1])
    return bg
  return img.convert("RGB")

def ensure_dir(p: Path) -> None:
  p.mkdir(parents=True, exist_ok=True)

def list_files(p: Path, exts: set[str]) -> List[Path]:
  if not p.exists():
    return []
  files = []
  for f in sorted(p.iterdir()):
    if f.is_file() and f.suffix.lower() in exts:
      files.append(f)
  return files

def safe_name(p: Path) -> str:
  # Keep original filename stem but normalize spaces; output as .jpg
  stem = re.sub(r"\s+", "-", p.stem.strip())
  stem = re.sub(r"[^A-Za-z0-9_-]+", "", stem)
  if not stem:
    stem = "img"
  return stem + ".jpg"

def embed_url(u: str) -> Optional[str]:
  u = (u or "").strip()
  if not u:
    return None
  # YouTube
  m = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{6,})", u)
  if m:
    vid = m.group(1)
    return f"https://www.youtube.com/embed/{vid}"
  # Vimeo
  m = re.search(r"vimeo\.com/(\d+)", u)
  if m:
    vid = m.group(1)
    return f"https://player.vimeo.com/video/{vid}"
  # If user already provided an embed URL, accept it
  if "youtube.com/embed/" in u or "player.vimeo.com/video/" in u:
    return u
  return None

def main() -> None:
  repo = Path(__file__).resolve().parents[1]
  projects_dir = repo / "projects"
  generated_dir = repo / "generated"
  ensure_dir(projects_dir)
  ensure_dir(generated_dir)

  projects: List[dict] = []

  for proj in sorted([p for p in projects_dir.iterdir() if p.is_dir()]):
    slug = proj.name
    if not slug_ok(slug):
      print(f"[skip] invalid slug folder name: {slug}")
      continue

    cfg_path = proj / "project.json"
    cfg = {}
    if cfg_path.exists():
      try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
      except Exception as e:
        print(f"[warn] failed to parse {cfg_path}: {e}")
        cfg = {}

    title = cfg.get("title") or slug.replace("-", " ").title()
    location = cfg.get("location", "")
    date = cfg.get("date", "")
    projectType = cfg.get("projectType", "")
    scope = cfg.get("scope", "")
    status = cfg.get("status", "")
    buildingArea = cfg.get("buildingArea", "")
    client = cfg.get("client", "")
    notes = cfg.get("notes", "")
    summary = cfg.get("summary", "")
    tags = cfg.get("tags", []) if isinstance(cfg.get("tags", []), list) else []

    # videos via config
    cfg_videos = cfg.get("videos", {}) if isinstance(cfg.get("videos", {}), dict) else {}

    phases: Dict[str, dict] = {}
    cover_thumb = ""

    for phase in PHASES:
      phase_dir = proj / phase
      imgs = list_files(phase_dir, IMG_EXTS)

      out_base = generated_dir / slug / phase
      out_thumb = out_base / "thumb"
      out_large = out_base / "large"
      ensure_dir(out_thumb)
      ensure_dir(out_large)

      phase_items = []
      for src in imgs:
        out_name = safe_name(src)
        dst_thumb = out_thumb / out_name
        dst_large = out_large / out_name

        # Build if missing or outdated
        try:
          src_mtime = src.stat().st_mtime
          need_thumb = (not dst_thumb.exists()) or dst_thumb.stat().st_mtime < src_mtime
          need_large = (not dst_large.exists()) or dst_large.stat().st_mtime < src_mtime
        except FileNotFoundError:
          need_thumb = need_large = True

        if need_thumb or need_large:
          try:
            with Image.open(src) as im:
              im = ImageOps.exif_transpose(im)
              if need_thumb:
                t = to_jpg(im)
                # 先按 THUMB_MAX x THUMB_MAX 以内等比缩放（不裁剪）
                t_fit = ImageOps.contain(t, (THUMB_MAX, THUMB_MAX), method=Image.Resampling.LANCZOS)

                # 再贴到正方形背景上（两侧留白）
                bg = Image.new("RGB", (THUMB_MAX, THUMB_MAX), (255, 255, 255))  # 白色留白；想用深色就改成(11,15,23)
                x = (THUMB_MAX - t_fit.size[0]) // 2
                y = (THUMB_MAX - t_fit.size[1]) // 2
                bg.paste(t_fit, (x, y))

                bg.save(dst_thumb, "JPEG", quality=JPG_QUALITY, optimize=True, progressive=True)
              if need_large:
                l = resize_to_max(im, LARGE_MAX)
                l = to_jpg(l)
                l.save(dst_large, "JPEG", quality=JPG_QUALITY, optimize=True, progressive=True)
          except Exception as e:
            print(f"[warn] failed to process {src}: {e}")
            continue

        rel_thumb = f"/generated/{slug}/{phase}/thumb/{dst_thumb.name}"
        rel_large = f"/generated/{slug}/{phase}/large/{dst_large.name}" 
        phase_items.append({
          "srcThumb": rel_thumb,
          "srcLarge": rel_large,
          "alt": "",
        })

      # videos via local files
      local_vids = []
      vid_dir = proj / "video" / phase
      for vf in list_files(vid_dir, VID_EXTS):
        local_vids.append({
          "kind": "file",
          "url": f"/projects/{slug}/video/{phase}/{vf.name}"
        })

      # videos via links in config
      link_vids = []
      cfg_list = cfg_videos.get(phase, []) if isinstance(cfg_videos.get(phase, []), list) else []
      for v in cfg_list:
        if isinstance(v, str):
          eu = embed_url(v)
          if eu:
            link_vids.append({"kind":"embed","url": eu})
        elif isinstance(v, dict):
          u = v.get("url", "")
          eu = embed_url(u) or u
          if eu:
            kind = v.get("kind") or ("embed" if "embed" in eu else "embed")
            link_vids.append({"kind": kind, "url": eu})

      phases[phase] = {"images": phase_items, "videos": (link_vids + local_vids)}

      # cover image: first available in after>during>before
      if not cover_thumb and phase_items:
        cover_thumb = phase_items[0]["srcThumb"]

    # Choose cover priority
    def pick_cover():
      for ph in ["renderings","after","during","before"]:
        arr = phases.get(ph, {}).get("images", [])
        if arr:
          return arr[0]["srcThumb"]
      return ""
    cover_thumb = pick_cover()

    # sortKey: prefer date as string, fallback slug
    sort_key = str(date) if date else slug

    projects.append({
      "slug": slug,
      "title": title,
      "location": location,
      "date": date,
      "projectType": projectType,
      "scope": scope,
      "status": status,
      "buildingArea": buildingArea,
      "client": client,
      "notes": notes,
      "summary": summary,
      "tags": tags,
      "coverThumb": cover_thumb,
      "sortKey": sort_key,
      "phases": phases,
    })

    # Ensure project detail page exists (create if missing)
    proj_index = proj / "index.html"
    if not proj_index.exists():
      # We keep the project page template in tools/templates-project.html
      template_path = repo / "tools" / "project-template.html"
      tpl = template_path.read_text(encoding="utf-8")
      # Minimal subtitle placeholder; JS will replace
      subtitle = ""
      nav = (repo / "tools" / "nav-project.html").read_text(encoding="utf-8")
      html = tpl.replace("{{TITLE}}", title).replace("{{SLUG}}", slug).replace("{{SUBTITLE}}", subtitle).replace("{{NAV}}", nav)
      ensure_dir(proj)
      proj_index.write_text(html, encoding="utf-8")
      print(f"[create] {proj_index.relative_to(repo)}")

  # Write gallery.json
  gallery = {"projects": projects}
  (generated_dir / "gallery.json").write_text(json.dumps(gallery, ensure_ascii=False, indent=2), encoding="utf-8")
  print(f"[ok] wrote generated/gallery.json with {len(projects)} project(s)")

if __name__ == "__main__":
  main()
