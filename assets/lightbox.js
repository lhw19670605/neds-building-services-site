export function createLightbox() {
  const overlay = document.querySelector("#lightbox");
  const img = overlay.querySelector("#lightboxImg");
  const btnPrev = overlay.querySelector("#lbPrev");
  const btnNext = overlay.querySelector("#lbNext");
  const btnClose = overlay.querySelector("#lbClose");

  let items = [];
  let idx = 0;

  function open(newItems, startIndex=0) {
    items = newItems || [];
    idx = Math.max(0, Math.min(startIndex, items.length-1));
    render();
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function render() {
    if (!items.length) return;
    img.src = items[idx].srcLarge;
    img.alt = items[idx].alt || "";
    btnPrev.style.display = items.length > 1 ? "block" : "none";
    btnNext.style.display = items.length > 1 ? "block" : "none";
  }

  function prev() {
    if (!items.length) return;
    idx = (idx - 1 + items.length) % items.length;
    render();
  }
  function next() {
    if (!items.length) return;
    idx = (idx + 1) % items.length;
    render();
  }

  btnPrev.addEventListener("click", (e)=>{e.stopPropagation(); prev();});
  btnNext.addEventListener("click", (e)=>{e.stopPropagation(); next();});
  btnClose.addEventListener("click", (e)=>{e.stopPropagation(); close();});
  overlay.addEventListener("click", close);

  document.addEventListener("keydown", (e)=>{
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  return { open, close };
}
