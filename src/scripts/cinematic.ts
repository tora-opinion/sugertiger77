// Scroll-linked motion: parallax, word reveal, expanding frame and the pinned project switcher.
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function initCinematic() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pinned = window.matchMedia("(min-width: 901px)");

  const header = document.querySelector<HTMLElement>(".site-header");
  const parallax = Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
  const words = Array.from(document.querySelectorAll<HTMLElement>(".reveal-word"));
  const wordsHost = document.querySelector<HTMLElement>("[data-reveal]");
  const expand = document.querySelector<HTMLElement>("[data-expand]");
  const frame = expand?.querySelector<HTMLElement>("[data-expand-frame]");
  const frameImgs = Array.from(frame?.querySelectorAll<HTMLElement>(".photo") ?? []);
  const caption = expand?.querySelector<HTMLElement>("[data-expand-cap]");
  const works = document.querySelector<HTMLElement>("[data-works]");
  const items = Array.from(works?.querySelectorAll<HTMLElement>("[data-work]") ?? []);
  const views = Array.from(works?.querySelectorAll<HTMLElement>("[data-work-view]") ?? []);
  const photoLayers = Array.from(works?.querySelectorAll<HTMLElement>("[data-work-photo]") ?? []);

  let current = -1;
  const setWork = (index: number) => {
    if (index === current) return;
    current = index;
    items.forEach((item, i) => {
      item.classList.toggle("on", i === index);
      if (pinned.matches) item.querySelector("[data-work-btn]")?.setAttribute("aria-expanded", String(i === index));
    });
    views.forEach((view, i) => view.classList.toggle("on", i === index));
    const photoIndex = index % Math.max(photoLayers.length, 1);
    photoLayers.forEach((layer, i) => layer.classList.toggle("on", i === photoIndex));
  };
  setWork(0);

  // The list buttons only drive the pinned layout; on narrow screens every card is already expanded.
  const syncButtons = () => {
    items.forEach((item, i) => {
      const btn = item.querySelector<HTMLElement>("[data-work-btn]");
      if (!btn) return;
      if (pinned.matches) {
        btn.removeAttribute("tabindex");
        btn.setAttribute("aria-expanded", String(i === current));
      } else {
        btn.setAttribute("tabindex", "-1");
        btn.removeAttribute("aria-expanded");
      }
    });
  };
  syncButtons();
  pinned.addEventListener("change", syncButtons);

  const workProgressTop = (index: number) => {
    if (!works) return 0;
    const total = works.offsetHeight - window.innerHeight;
    const top = works.getBoundingClientRect().top + window.scrollY;
    return top + total * ((index + 0.5) / items.length);
  };

  items.forEach((item, i) => {
    item.querySelector("[data-work-btn]")?.addEventListener("click", () => {
      if (!pinned.matches) return;
      setWork(i);
      window.scrollTo({ top: workProgressTop(i), behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  const update = () => {
    const vh = window.innerHeight;
    header?.setAttribute("data-scrolled", String(window.scrollY > 24));

    if (works && items.length && pinned.matches) {
      const r = works.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(works.offsetHeight - vh, 1));
      setWork(Math.min(items.length - 1, Math.floor(p * items.length)));
    }

    if (reduceMotion) return;

    parallax.forEach((el) => {
      const host = el.parentElement;
      if (!host) return;
      const r = host.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      el.style.transform = `translate3d(0, ${-(r.top + r.height / 2 - vh / 2) * Number(el.dataset.par)}px, 0)`;
    });

    if (wordsHost && words.length) {
      const r = wordsHost.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (vh * 0.55 + r.height * 0.6));
      const lit = Math.floor(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < lit));
    }

    if (expand && frame && caption) {
      const r = expand.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(expand.offsetHeight - vh, 1));
      const k = easeOut(clamp(p / 0.7));
      frame.style.width = `${34 + 66 * k}vw`;
      frame.style.height = `${44 + 56 * k}vh`;
      frame.style.borderRadius = `${28 * (1 - k)}px`;
      frame.style.setProperty("--dim", String(0.1 + 0.4 * k));
      frameImgs.forEach((img) => (img.style.transform = `scale(${1.25 - 0.25 * k})`));
      caption.style.setProperty("--t", String(clamp((p - 0.5) / 0.3)));
    }
  };

  if (reduceMotion) {
    words.forEach((w) => w.classList.add("on"));
    if (frame && caption) {
      frame.style.width = "100vw";
      frame.style.height = "100vh";
      frame.style.borderRadius = "0";
      frame.style.setProperty("--dim", "0.5");
      frameImgs.forEach((img) => (img.style.transform = "none"));
      caption.style.setProperty("--t", "1");
    }
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    },
    { passive: true },
  );
  window.addEventListener("resize", update);
  update();
}
