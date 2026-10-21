// Scroll-linked motion: hero dispersal, word reveal, expanding frame, project scenes,
// velocity-driven marquee and the photo-filled closing title.
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function initCinematic() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const header = document.querySelector<HTMLElement>(".site-header");
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  const heroBg = hero?.querySelector<HTMLElement>("[data-hero-bg]");
  const words = Array.from(document.querySelectorAll<HTMLElement>(".reveal-word"));
  const wordsHost = document.querySelector<HTMLElement>("[data-reveal]");
  const expand = document.querySelector<HTMLElement>("[data-expand]");
  const frame = expand?.querySelector<HTMLElement>("[data-expand-frame]");
  const frameImgs = Array.from(frame?.querySelectorAll<HTMLElement>(".photo") ?? []);
  const caption = expand?.querySelector<HTMLElement>("[data-expand-cap]");
  const works = document.querySelector<HTMLElement>("[data-works]");
  const scenes = Array.from(works?.querySelectorAll<HTMLElement>("[data-work]") ?? []);
  const ticks = Array.from(works?.querySelectorAll<HTMLElement>("[data-work-btn]") ?? []);
  const photoHost = works?.querySelector<HTMLElement>("[data-work-photos]");
  const photoLayers = Array.from(works?.querySelectorAll<HTMLElement>("[data-work-photo]") ?? []);
  const finale = document.querySelector<HTMLElement>("[data-final]");
  const marquee = document.querySelector<HTMLElement>(".marquee-track");

  // ---------- project scenes ----------
  let current = 0;
  let currentPhoto = 0;
  const setScene = (index: number) => {
    if (index === current) return;
    const forward = index > current;
    current = index;
    scenes.forEach((scene, i) => {
      scene.classList.toggle("on", i === index);
      scene.classList.toggle("past", i < index);
    });
    ticks.forEach((tick, i) => {
      tick.classList.toggle("on", i === index);
      if (i === index) tick.setAttribute("aria-current", "true");
      else tick.removeAttribute("aria-current");
    });
    const nextPhoto = index % Math.max(photoLayers.length, 1);
    if (nextPhoto !== currentPhoto && photoLayers.length) {
      photoHost?.setAttribute("data-dir", forward ? "down" : "up");
      photoLayers.forEach((layer, i) => {
        layer.classList.toggle("prev", i === currentPhoto);
        layer.classList.toggle("on", i === nextPhoto);
      });
      currentPhoto = nextPhoto;
    }
  };

  const sceneScrollTop = (index: number) => {
    if (!works) return 0;
    const total = works.offsetHeight - window.innerHeight;
    const top = works.getBoundingClientRect().top + window.scrollY;
    return top + total * ((index + 0.5) / scenes.length);
  };
  ticks.forEach((tick, i) => {
    tick.addEventListener("click", () => {
      window.scrollTo({ top: sceneScrollTop(i), behavior: reduceMotion ? "auto" : "smooth" });
      setScene(i);
    });
  });
  // Keyboard users tabbing into a hidden scene's link jump to that scene.
  scenes.forEach((scene, i) => {
    scene.addEventListener("focusin", () => {
      if (i !== current) window.scrollTo({ top: sceneScrollTop(i), behavior: "auto" });
    });
  });

  // ---------- marquee driven by scroll velocity ----------
  let marqueeX = 0;
  let velocity = 0;
  let lastY = window.scrollY;
  let marqueeFrame = 0;
  if (marquee && !reduceMotion) {
    const loop = () => {
      const y = window.scrollY;
      velocity += (y - lastY - velocity) * 0.12;
      lastY = y;
      const half = marquee.scrollWidth / 2;
      marqueeX -= 0.7 + Math.abs(velocity) * 0.35;
      if (half > 0 && -marqueeX >= half) marqueeX += half;
      const skew = clamp(velocity * -0.25, -14, 14);
      marquee.style.transform = `translate3d(${marqueeX}px, 0, 0) skewX(${skew}deg)`;
      marqueeFrame = requestAnimationFrame(loop);
    };
    // Only animate while the marquee is on screen.
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !marqueeFrame) {
        lastY = window.scrollY;
        velocity = 0;
        marqueeFrame = requestAnimationFrame(loop);
      } else if (!entry.isIntersecting && marqueeFrame) {
        cancelAnimationFrame(marqueeFrame);
        marqueeFrame = 0;
      }
    }).observe(marquee);
  }

  // ---------- scroll frame ----------
  const update = () => {
    const vh = window.innerHeight;
    header?.setAttribute("data-scrolled", String(window.scrollY > 24));

    if (works && scenes.length) {
      const r = works.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(works.offsetHeight - vh, 1));
      works.style.setProperty("--wp", p.toFixed(4));
      // Bars close as the section pins and open again on the way out.
      const lb = reduceMotion ? 0 : Math.min(clamp(p / 0.06), clamp((1 - p) / 0.06));
      works.style.setProperty("--lb", lb.toFixed(3));
      setScene(Math.min(scenes.length - 1, Math.floor(p * scenes.length)));
    }

    if (reduceMotion) return;

    if (hero && heroBg) {
      const r = hero.getBoundingClientRect();
      const hp = clamp(-r.top / r.height);
      hero.style.setProperty("--hp", hp.toFixed(4));
      heroBg.style.transform = `translate3d(0, ${hp * r.height * 0.3}px, 0) scale(${1 + hp * 0.22})`;
    }

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
      frame.style.transform = `rotate(${-7 * (1 - k)}deg)`;
      frame.style.setProperty("--dim", String(0.1 + 0.4 * k));
      frameImgs.forEach((img) => (img.style.transform = `scale(${1.25 - 0.25 * k}) rotate(${7 * (1 - k)}deg)`));
      caption.style.setProperty("--t", String(clamp((p - 0.5) / 0.3)));
    }

    if (finale) {
      const r = finale.getBoundingClientRect();
      const fp = easeOut(clamp((vh - r.top) / (vh * 0.9)));
      finale.style.setProperty("--fp", fp.toFixed(4));
    }
  };

  if (reduceMotion) {
    words.forEach((w) => w.classList.add("on"));
    finale?.style.setProperty("--fp", "1");
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
