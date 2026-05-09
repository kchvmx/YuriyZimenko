import { useState, useEffect, useRef, useCallback } from "react";

/* ─── PALETTE & TOKENS ─────────────────────────────────────── */
const C = {
  black:   "#050505",
  dark:    "#0D0C0A",
  mid:     "#1A1915",
  warm:    "#2A2720",
  champagne:"#C9A96E",
  champDim: "rgba(201,169,110,0.18)",
  champLine:"rgba(201,169,110,0.22)",
  white:   "#F5F2EC",
  muted:   "#8A8478",
  line:    "rgba(245,242,236,0.08)",
};

/* ─── GLOBAL STYLES injected once ─────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@200;300;400;500&display=swap');

  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { background:${C.black}; color:${C.white}; font-family:'Jost',sans-serif; cursor:none; overflow-x:hidden; }

  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-track { background:${C.black}; }
  ::-webkit-scrollbar-thumb { background:${C.champagne}; }

  /* cursor */
  .cur-dot  { position:fixed; width:6px; height:6px; border-radius:50%; background:${C.champagne}; pointer-events:none; z-index:9999; transform:translate(-50%,-50%); transition:transform .12s ease,opacity .2s; }
  .cur-ring { position:fixed; width:36px; height:36px; border-radius:50%; border:1px solid ${C.champLine}; pointer-events:none; z-index:9998; transform:translate(-50%,-50%); transition:transform .55s cubic-bezier(.16,1,.3,1),width .4s,height .4s,opacity .3s; }
  .cur-ring.expand { width:56px; height:56px; opacity:.6; }

  /* reveals */
  .reveal { opacity:0; transform:translateY(32px); transition:opacity 1.1s cubic-bezier(.16,1,.3,1), transform 1.1s cubic-bezier(.16,1,.3,1); }
  .reveal.visible { opacity:1; transform:none; }
  .reveal-slow { opacity:0; transform:translateY(20px); transition:opacity 1.6s cubic-bezier(.16,1,.3,1), transform 1.6s cubic-bezier(.16,1,.3,1); }
  .reveal-slow.visible { opacity:1; transform:none; }
  .reveal-line { opacity:0; transform:translateY(40px); }
  .reveal-line.visible { opacity:1; transform:none; }

  /* noise overlay */
  .noise::after {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:8000; opacity:.025;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  }

  /* horizontal rule */
  .hr-champ { border:none; border-top:1px solid ${C.champLine}; }

  /* nav */
  nav.zimenko-nav {
    position:fixed; top:0; left:0; right:0; z-index:400;
    padding:28px 60px; display:flex; align-items:center; justify-content:space-between;
    transition:background .6s, padding .4s, border-color .6s;
    border-bottom:1px solid transparent;
  }
  nav.zimenko-nav.scrolled {
    padding:18px 60px;
    background:rgba(5,5,5,0.92);
    backdrop-filter:blur(20px);
    border-bottom-color:${C.line};
  }
  nav.zimenko-nav.hidden { transform:translateY(-100%); }

  /* form */
  .z-input {
    width:100%; background:transparent; border:none; border-bottom:1px solid ${C.line};
    color:${C.white}; font-family:'Jost',sans-serif; font-size:14px; font-weight:300;
    padding:14px 0; outline:none; letter-spacing:.06em;
    transition:border-color .4s;
  }
  .z-input::placeholder { color:${C.muted}; }
  .z-input:focus { border-bottom-color:${C.champagne}; }
  textarea.z-input { resize:none; padding-top:14px; }

  @keyframes scrollDot { 0%{transform:translateY(0);opacity:1} 60%{transform:translateY(12px);opacity:0} 100%{transform:translateY(0);opacity:0} }
  @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  @keyframes lineGrow { from{width:0} to{width:100%} }

  @media(max-width:768px){
    nav.zimenko-nav, nav.zimenko-nav.scrolled { padding:20px 24px; }
    .mob-hide { display:none!important; }
  }
`;

/* ─── HOOK: reveal on scroll ───────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal, .reveal-slow");
    const io = new IntersectionObserver(entries => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          const delay = e.target.dataset.delay || 0;
          setTimeout(() => e.target.classList.add("visible"), Number(delay));
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  });
}

/* ─── HOOK: stagger children ───────────────────────────────── */
function useStagger(selector, base = 0) {
  useEffect(() => {
    const items = document.querySelectorAll(selector);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = [...items].indexOf(e.target);
          setTimeout(() => e.target.classList.add("visible"), base + idx * 120);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    items.forEach(el => io.observe(el));
    return () => io.disconnect();
  });
}

/* ─── CURSOR ────────────────────────────────────────────────── */
function Cursor() {
  const dot  = useRef(null);
  const ring = useRef(null);
  const pos  = useRef({ x: 0, y: 0 });
  const raf  = useRef(null);
  const cur  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = e => { pos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", move);

    const tick = () => {
      cur.current.x += (pos.current.x - cur.current.x) * 0.1;
      cur.current.y += (pos.current.y - cur.current.y) * 0.1;
      if (ring.current) {
        ring.current.style.left = cur.current.x + "px";
        ring.current.style.top  = cur.current.y + "px";
      }
      if (dot.current) {
        dot.current.style.left = pos.current.x + "px";
        dot.current.style.top  = pos.current.y + "px";
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    const over  = () => ring.current?.classList.add("expand");
    const out   = () => ring.current?.classList.remove("expand");
    document.querySelectorAll("a,button,[data-hover]").forEach(el => {
      el.addEventListener("mouseenter", over);
      el.addEventListener("mouseleave", out);
    });

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div ref={dot}  className="cur-dot"  />
      <div ref={ring} className="cur-ring" />
    </>
  );
}

/* ─── NAV ───────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Проєкти",  href: "#projects"  },
  { label: "Послуги",  href: "#services"  },
  { label: "Студія",   href: "#studio"    },
  { label: "Контакти", href: "#contact"   },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden,   setHidden]   = useState(false);
  const [open,     setOpen]     = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setHidden(y > lastY.current && y > 200);
      lastY.current = y;
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const cls = `zimenko-nav${scrolled ? " scrolled" : ""}${hidden && !open ? " hidden" : ""}`;

  return (
    <nav className={cls} style={{ transition: "transform .5s cubic-bezier(.16,1,.3,1), background .6s, padding .4s, border-color .6s" }}>
      {/* Logo */}
      <a href="#top" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          border: `1px solid ${C.champLine}`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 10, letterSpacing: "0.1em", color: C.champagne }}>YZ</span>
        </div>
        <div className="mob-hide">
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 400, letterSpacing: "0.18em", color: C.white }}>
            ZIMENKO
          </div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.32em", color: C.muted, textTransform: "uppercase", marginTop: 1 }}>
            DESIGN STUDIO
          </div>
        </div>
      </a>

      {/* Links desktop */}
      <ul className="mob-hide" style={{ display: "flex", gap: 40, listStyle: "none" }}>
        {NAV_LINKS.map(l => (
          <li key={l.href}>
            <a href={l.href} style={{
              fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: "0.28em",
              textTransform: "uppercase", color: C.muted, textDecoration: "none",
              transition: "color .3s",
            }}
              onMouseEnter={e => e.target.style.color = C.champagne}
              onMouseLeave={e => e.target.style.color = C.muted}
            >{l.label}</a>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a href="#contact" className="mob-hide" style={{
        fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.28em",
        textTransform: "uppercase", color: C.champagne,
        border: `1px solid ${C.champLine}`, padding: "10px 22px",
        textDecoration: "none", transition: "all .35s",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = C.champagne; e.currentTarget.style.color = C.black; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.champagne; }}
      >
        Консультація
      </a>

      {/* Burger mobile */}
      <button onClick={() => setOpen(!open)} style={{
        display: "none", background: "none", border: "none", cursor: "none",
        color: C.white, fontSize: 20,
      }} className="mob-show">☰</button>
    </nav>
  );
}

/* ─── HERO ──────────────────────────────────────────────────── */
function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 200); }, []);

  return (
    <section id="top" style={{
      minHeight: "100vh", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", background: C.black,
    }}>
      {/* Background ambient */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 60% 40%, rgba(201,169,110,0.04) 0%, transparent 70%),
                     radial-gradient(ellipse 50% 80% at 20% 70%, rgba(201,169,110,0.03) 0%, transparent 60%)`,
      }} />

      {/* Vertical rule lines */}
      {[20, 50, 80].map(x => (
        <div key={x} style={{
          position: "absolute", top: 0, bottom: 0, left: `${x}%`,
          width: 1, background: C.line, opacity: 0.5,
        }} />
      ))}

      {/* Large background text */}
      <div style={{
        position: "absolute", bottom: "8%", left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: "clamp(80px,18vw,240px)",
        fontWeight: 300, fontStyle: "italic",
        color: "rgba(201,169,110,0.03)",
        whiteSpace: "nowrap", letterSpacing: "0.06em",
        userSelect: "none", pointerEvents: "none",
      }}>
        ZIMENKO
      </div>

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 2, textAlign: "center",
        padding: "0 40px", maxWidth: 900,
      }}>
        {/* Eyebrow */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, marginBottom: 48,
          opacity: loaded ? 1 : 0,
          transform: loaded ? "none" : "translateY(20px)",
          transition: "opacity 1.2s .2s cubic-bezier(.16,1,.3,1), transform 1.2s .2s cubic-bezier(.16,1,.3,1)",
        }}>
          <div style={{ width: 40, height: 1, background: C.champagne, opacity: 0.6 }} />
          <span style={{
            fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.38em",
            textTransform: "uppercase", color: C.champagne, fontWeight: 300,
          }}>Студія інтер'єрного дизайну · Київ</span>
          <div style={{ width: 40, height: 1, background: C.champagne, opacity: 0.6 }} />
        </div>

        {/* Main headline */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: "clamp(52px,8vw,110px)",
          fontWeight: 300, lineHeight: 0.92,
          letterSpacing: "-0.01em", color: C.white,
          marginBottom: 40,
          opacity: loaded ? 1 : 0,
          transform: loaded ? "none" : "translateY(40px)",
          transition: "opacity 1.2s .4s cubic-bezier(.16,1,.3,1), transform 1.2s .4s cubic-bezier(.16,1,.3,1)",
        }}>
          Простір,<br />
          <em style={{ color: C.champagne, fontStyle: "italic" }}>що відображає</em><br />
          вашу сутність
        </h1>

        {/* Sub */}
        <p style={{
          fontFamily: "'Jost',sans-serif", fontSize: "clamp(13px,1.5vw,16px)",
          fontWeight: 300, color: C.muted, lineHeight: 1.9,
          letterSpacing: "0.04em", maxWidth: 520, margin: "0 auto 56px",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "none" : "translateY(30px)",
          transition: "opacity 1.2s .6s cubic-bezier(.16,1,.3,1), transform 1.2s .6s cubic-bezier(.16,1,.3,1)",
        }}>
          Ми створюємо інтер'єри, які стають продовженням вашої особистості — гармонійне поєднання стилю, функціональності та унікального характеру.
        </p>

        {/* CTA row */}
        <div style={{
          display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "none" : "translateY(20px)",
          transition: "opacity 1.2s .8s cubic-bezier(.16,1,.3,1), transform 1.2s .8s cubic-bezier(.16,1,.3,1)",
        }}>
          <a href="#projects" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: "0.28em",
            textTransform: "uppercase", textDecoration: "none",
            background: C.champagne, color: C.black,
            padding: "15px 36px", fontWeight: 500, transition: "all .35s",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            Переглянути проєкти
          </a>
          <a href="#contact" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: "0.28em",
            textTransform: "uppercase", textDecoration: "none",
            border: `1px solid ${C.champLine}`, color: C.muted,
            padding: "15px 36px", transition: "all .35s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.champagne; e.currentTarget.style.color = C.champagne; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.champLine; e.currentTarget.style.color = C.muted; }}
          >
            Написати нам
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        opacity: loaded ? 0.5 : 0, transition: "opacity 1s 1.5s",
      }}>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted }}>
          Гортати
        </span>
        <div style={{ width: 1, height: 48, background: `linear-gradient(to bottom, ${C.champagne}, transparent)`,
          animation: "scrollDot 2s ease-in-out infinite" }} />
      </div>
    </section>
  );
}

/* ─── MANIFESTO ─────────────────────────────────────────────── */
function Manifesto() {
  useReveal();
  return (
    <section style={{
      background: C.dark, padding: "140px 60px",
      display: "grid", gridTemplateColumns: "1fr 2fr", gap: 80,
      alignItems: "center",
    }}>
      {/* Left: ornament */}
      <div className="reveal" style={{ textAlign: "center" }}>
        <div style={{
          width: 1, height: 80, background: C.champLine,
          margin: "0 auto 24px",
        }} />
        <div style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 11, letterSpacing: "0.4em", textTransform: "uppercase",
          color: C.champagne, fontWeight: 400,
        }}>
          Маніфест<br />студії
        </div>
        <div style={{
          width: 1, height: 80, background: C.champLine,
          margin: "24px auto 0",
        }} />
      </div>

      {/* Right: quote */}
      <div>
        <p className="reveal" data-delay="100" style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: "clamp(24px,3vw,40px)", fontWeight: 300,
          lineHeight: 1.4, letterSpacing: "0.02em",
          color: C.white, marginBottom: 32,
        }}>
          "Ми створюємо інтер'єри, які стають продовженням вашої особистості. Кожен наш проєкт — це гармонійне поєднання стилю, функціональності та унікального характеру, що відображає ваші цінності, мрії та спосіб життя."
        </p>
        <div className="reveal" data-delay="200" style={{
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ width: 32, height: 1, background: C.champane }} />
          <span style={{
            fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: "0.3em",
            textTransform: "uppercase", color: C.champagne,
          }}>
            Юрій Зіменко
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── PROJECTS ──────────────────────────────────────────────── */
const PROJECTS = [
  {
    num: "01", title: "Apartment — Kyiv", sub: "Класичний люкс · 180 м²",
    desc: "Темне дерево, золоті акценти, французька класика. Простір, що дихає елегантністю.",
    accent: C.champagne,
    grad: "linear-gradient(135deg,#2A2118 0%,#1A1510 50%,#0D0B08 100%)",
    icon: "🏛",
  },
  {
    num: "02", title: "Penthouse — Kyiv", sub: "Сучасна класика · 320 м²",
    desc: "Відкриті простори, панорамні вікна та бездоганне відчуття масштабу.",
    accent: "#A89070",
    grad: "linear-gradient(135deg,#1E2228 0%,#141820 50%,#0A0C10 100%)",
    icon: "🌆",
  },
  {
    num: "03", title: "Private House — Kyiv", sub: "Архітектурний мінімалізм · 450 м²",
    desc: "Природне каміння, натуральні тканини, абсолютний спокій форми.",
    accent: "#8A9A80",
    grad: "linear-gradient(135deg,#181E18 0%,#101410 50%,#080A08 100%)",
    icon: "🌿",
  },
  {
    num: "04", title: "Restaurant — Kyiv", sub: "Комерційний інтер'єр · 280 м²",
    desc: "Атмосферне освітлення, ексклюзивні матеріали, незабутня подача.",
    accent: "#B87060",
    grad: "linear-gradient(135deg,#221814 0%,#180E0A 50%,#0A0806 100%)",
    icon: "🕯",
  },
];

function ProjectCard({ p, i }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="reveal" data-delay={i * 100}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderTop: `1px solid ${C.line}`,
        padding: "40px 0",
        display: "grid",
        gridTemplateColumns: "80px 1fr auto",
        gap: 32,
        alignItems: "center",
        cursor: "default",
        transition: "padding-left .4s cubic-bezier(.16,1,.3,1)",
        paddingLeft: hov ? 12 : 0,
      }}>
      {/* Num */}
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: 13, letterSpacing: "0.3em", color: C.muted, fontStyle: "italic",
      }}>{p.num}</div>

      {/* Title block */}
      <div>
        <div style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: "clamp(22px,3vw,36px)", fontWeight: 400,
          color: hov ? p.accent : C.white,
          transition: "color .4s",
          letterSpacing: "0.02em",
          marginBottom: 6,
        }}>{p.title}</div>
        <div style={{
          fontFamily: "'Jost',sans-serif", fontSize: 11,
          letterSpacing: "0.22em", textTransform: "uppercase",
          color: C.muted, fontWeight: 300,
        }}>{p.sub}</div>
        <div style={{
          fontFamily: "'Jost',sans-serif", fontSize: 13,
          color: C.muted, fontWeight: 300,
          lineHeight: 1.7, marginTop: 10,
          maxHeight: hov ? 60 : 0,
          overflow: "hidden",
          transition: "max-height .5s cubic-bezier(.16,1,.3,1), opacity .4s",
          opacity: hov ? 1 : 0,
        }}>{p.desc}</div>
      </div>

      {/* Preview box */}
      <div style={{
        width: hov ? 180 : 60,
        height: 80,
        background: p.grad,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: hov ? 28 : 16,
        transition: "width .6s cubic-bezier(.16,1,.3,1), font-size .4s",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <span style={{ transition: "opacity .4s", opacity: 0.6 }}>{p.icon}</span>
      </div>
    </div>
  );
}

function Projects() {
  return (
    <section id="projects" style={{ background: C.black, padding: "120px 80px" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-end", marginBottom: 72,
        borderBottom: `1px solid ${C.line}`, paddingBottom: 40,
      }}>
        <div>
          <div className="reveal" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 10,
            letterSpacing: "0.38em", textTransform: "uppercase",
            color: C.champagne, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ display: "block", width: 20, height: 1, background: C.champagne }} />
            Вибрані роботи
          </div>
          <h2 className="reveal" data-delay="100" style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: "clamp(36px,5vw,64px)", fontWeight: 300,
            lineHeight: 1.0, color: C.white,
          }}>
            Наші<br /><em style={{ color: C.champagne }}>проєкти</em>
          </h2>
        </div>
        <div className="reveal mob-hide" style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 13,
          fontStyle: "italic", color: C.muted, maxWidth: 260, textAlign: "right",
          lineHeight: 1.7,
        }}>
          Кожен проєкт — унікальна історія простору та його мешканців
        </div>
      </div>

      {/* Project list */}
      <div>
        {PROJECTS.map((p, i) => <ProjectCard key={p.num} p={p} i={i} />)}
        <div style={{ borderTop: `1px solid ${C.line}` }} />
      </div>

      {/* Bottom CTA */}
      <div className="reveal" style={{ textAlign: "center", marginTop: 72 }}>
        <a href="#contact" style={{
          fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.32em",
          textTransform: "uppercase", color: C.muted, textDecoration: "none",
          borderBottom: `1px solid ${C.champLine}`, paddingBottom: 3,
          transition: "color .3s, border-color .3s",
        }}
          onMouseEnter={e => { e.currentTarget.style.color = C.champagne; e.currentTarget.style.borderColor = C.champagne; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.champLine; }}
        >
          Обговорити ваш проєкт →
        </a>
      </div>
    </section>
  );
}

/* ─── SERVICES ──────────────────────────────────────────────── */
const SERVICES = [
  { num: "I",   title: "Дизайн квартир",           desc: "Від концепції до авторського нагляду. Бюджетні рішення, що не поступаються якістю люксу." },
  { num: "II",  title: "Дизайн будинків",           desc: "Приватні резиденції з індивідуальною архітектурною мовою та продуманою ергономікою." },
  { num: "III", title: "Комерційні інтер'єри",      desc: "Ресторани, офіси, готелі. Простір, що працює на ваш бренд та залишає враження." },
  { num: "IV",  title: "Архітектурне проєктування", desc: "Повний цикл — від генерального плану до деталей фасаду та ландшафтного дизайну." },
  { num: "V",   title: "Авторський супровід",       desc: "Ми залишаємось поруч від першого ескізу до останнього цвяха. Контроль, якість, спокій." },
];

function Services() {
  return (
    <section id="services" style={{ background: C.mid, padding: "120px 80px" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 80, alignItems: "start",
      }}>
        {/* Left sticky header */}
        <div style={{ position: "sticky", top: 100 }}>
          <div className="reveal" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.38em",
            textTransform: "uppercase", color: C.champagne,
            display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          }}>
            <span style={{ width: 20, height: 1, display: "block", background: C.champagne }} />
            Послуги
          </div>
          <h2 className="reveal" data-delay="100" style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: "clamp(36px,4.5vw,60px)", fontWeight: 300,
            lineHeight: 1.05, color: C.white, marginBottom: 28,
          }}>
            Що ми<br /><em style={{ color: C.champagne }}>робимо</em>
          </h2>
          <p className="reveal" data-delay="200" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 14, lineHeight: 1.85,
            color: C.muted, fontWeight: 300, maxWidth: 360,
          }}>
            Повний спектр послуг від концепції до реалізації. Ми відповідаємо за результат — не лише за проєкт.
          </p>
        </div>

        {/* Right: service list */}
        <div>
          {SERVICES.map((s, i) => (
            <ServiceItem key={s.num} s={s} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceItem({ s, i }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="reveal" data-delay={i * 80}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderTop: `1px solid ${C.line}`,
        padding: "36px 0",
        cursor: "default",
        transition: "all .35s",
      }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 13, fontStyle: "italic", color: C.champagne,
          flexShrink: 0, marginTop: 4, letterSpacing: "0.1em",
        }}>{s.num}</div>
        <div>
          <div style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 24, fontWeight: 400,
            color: hov ? C.champagne : C.white,
            transition: "color .35s",
            marginBottom: 10,
          }}>{s.title}</div>
          <div style={{
            fontFamily: "'Jost',sans-serif", fontSize: 13,
            color: C.muted, fontWeight: 300, lineHeight: 1.75,
            maxHeight: hov ? 80 : 0,
            overflow: "hidden",
            transition: "max-height .5s cubic-bezier(.16,1,.3,1), opacity .4s",
            opacity: hov ? 1 : 0,
          }}>{s.desc}</div>
        </div>
        <div style={{ marginLeft: "auto", color: hov ? C.champagne : C.line, transition: "color .35s", fontSize: 18, flexShrink: 0 }}>
          →
        </div>
      </div>
    </div>
  );
}

/* ─── STUDIO / PROCESS ──────────────────────────────────────── */
const STEPS = [
  { n: "01", t: "Знайомство",         d: "Особиста зустріч, вивчення вашого стилю, побажань та бюджету. Ми слухаємо більше, ніж говоримо." },
  { n: "02", t: "Концепція",          d: "Стиль-бord, 3D-візуалізація, кольорові рішення. Ви бачите простір ще до початку робіт." },
  { n: "03", t: "Проєктування",       d: "Робочі креслення, специфікації, вибір матеріалів та меблів від перевірених постачальників." },
  { n: "04", t: "Авторський нагляд",  d: "Ми на об'єкті — контролюємо якість, вирішуємо питання, стежимо за деталями до фіналу." },
];

function Studio() {
  return (
    <section id="studio" style={{ background: C.black, padding: "120px 80px" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        marginBottom: 80, paddingBottom: 40, borderBottom: `1px solid ${C.line}`,
      }}>
        <div>
          <div className="reveal" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.38em",
            textTransform: "uppercase", color: C.champagne,
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          }}>
            <span style={{ width: 20, height: 1, display: "block", background: C.champagne }} />
            Підхід
          </div>
          <h2 className="reveal" data-delay="100" style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: "clamp(36px,5vw,64px)", fontWeight: 300,
            lineHeight: 1.0, color: C.white,
          }}>
            Як ми<br /><em style={{ color: C.champagne }}>працюємо</em>
          </h2>
        </div>
        <div className="reveal mob-hide" style={{
          fontFamily: "'Jost',sans-serif", fontSize: 13, color: C.muted,
          fontWeight: 300, maxWidth: 280, textAlign: "right", lineHeight: 1.75,
        }}>
          100% рекомендацій від наших клієнтів — Facebook та Google
        </div>
      </div>

      {/* Steps grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
        {STEPS.map((s, i) => <StepCard key={s.n} s={s} i={i} />)}
      </div>

      {/* Awards row */}
      <div className="reveal" style={{
        marginTop: 80, display: "flex", justifyContent: "center", gap: 60,
        flexWrap: "wrap", borderTop: `1px solid ${C.line}`, paddingTop: 56,
      }}>
        {[
          { n: "5.0", l: "Google Rating" },
          { n: "100%", l: "Рекомендацій" },
          { n: "3к", l: "Facebook" },
          { n: "239", l: "Проєктів" },
        ].map(a => (
          <div key={a.l} style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 42, fontWeight: 300, color: C.champagne, lineHeight: 1,
            }}>{a.n}</div>
            <div style={{
              fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.28em",
              textTransform: "uppercase", color: C.muted, marginTop: 6,
            }}>{a.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepCard({ s, i }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="reveal" data-delay={i * 100}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.mid : C.dark,
        padding: "48px 36px",
        transition: "background .4s",
        cursor: "default",
        borderTop: hov ? `2px solid ${C.champagne}` : `2px solid transparent`,
      }}>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: 48, fontStyle: "italic", fontWeight: 300,
        color: "rgba(201,169,110,0.15)", lineHeight: 1, marginBottom: 24,
      }}>{s.n}</div>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: 22, fontWeight: 400,
        color: hov ? C.champagne : C.white,
        transition: "color .35s", marginBottom: 14,
      }}>{s.t}</div>
      <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: 13,
        color: C.muted, lineHeight: 1.8, fontWeight: 300,
      }}>{s.d}</div>
    </div>
  );
}

/* ─── REVIEWS ───────────────────────────────────────────────── */
const REVIEWS = [
  {
    a: "Serhii Lohvyniuk",
    m: "Київ · 365 відгуків · Google",
    t: "Приємно працювати з даним виконавцем. Завдання було виконано швидко і в строк. Мало того, що все було виконано в строк — якість перевершила очікування.",
  },
  {
    a: "Ігор Чуйков",
    m: "Google · 5 років тому",
    t: "Проєкти просто космос! Переглянув сайт — радий, що є такі майстри в Україні. Готовність до взаємодії та увага до деталей — на найвищому рівні.",
  },
];

function Reviews() {
  return (
    <section style={{ background: C.dark, padding: "120px 80px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        marginBottom: 72, paddingBottom: 40, borderBottom: `1px solid ${C.line}`,
      }}>
        <div>
          <div className="reveal" style={{
            fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.38em",
            textTransform: "uppercase", color: C.champagne,
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          }}>
            <span style={{ width: 20, height: 1, display: "block", background: C.champagne }} />
            Відгуки
          </div>
          <h2 className="reveal" data-delay="100" style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: "clamp(36px,5vw,64px)", fontWeight: 300,
            lineHeight: 1.0, color: C.white,
          }}>
            Що кажуть<br /><em style={{ color: C.champagne }}>клієнти</em>
          </h2>
        </div>
        <div className="reveal" style={{
          display: "flex", alignItems: "flex-end", gap: 8,
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 56, fontWeight: 300, color: C.champagne, lineHeight: 1,
          }}>5.0</span>
          <div>
            <div style={{ color: C.champagne, fontSize: 16, letterSpacing: 4 }}>★★★★★</div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginTop: 4 }}>Google Maps</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {REVIEWS.map((r, i) => (
          <div key={i} className="reveal" data-delay={i * 120}
            style={{
              background: C.black, padding: "48px 44px",
              borderTop: `1px solid ${C.champLine}`, position: "relative",
            }}>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 80, fontStyle: "italic",
              color: "rgba(201,169,110,0.08)",
              position: "absolute", top: 8, left: 24,
              lineHeight: 1,
            }}>❝</div>
            <p style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 20, fontStyle: "italic",
              lineHeight: 1.65, color: C.white,
              marginBottom: 28, position: "relative",
            }}>{r.t}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: C.champDim, border: `1px solid ${C.champLine}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: C.champagne,
              }}>{r.a[0]}</div>
              <div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, fontWeight: 500, color: C.white }}>{r.a}</div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, marginTop: 2 }}>{r.m}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── CONTACT ───────────────────────────────────────────────── */
function Contact() {
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);

  const submit = e => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <section id="contact" style={{
      background: C.black, display: "grid", gridTemplateColumns: "1fr 1fr",
    }}>
      {/* Left info */}
      <div style={{
        padding: "100px 72px", borderRight: `1px solid ${C.line}`,
        background: C.dark,
      }}>
        <div className="reveal" style={{
          fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.38em",
          textTransform: "uppercase", color: C.champagne,
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
        }}>
          <span style={{ width: 20, height: 1, display: "block", background: C.champagne }} />
          Зв'яжіться
        </div>
        <h2 className="reveal" data-delay="100" style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: "clamp(36px,4.5vw,60px)", fontWeight: 300,
          lineHeight: 1.0, color: C.white, marginBottom: 48,
        }}>
          Розпочнімо<br /><em style={{ color: C.champagne }}>разом</em>
        </h2>

        {[
          { l: "Телефон", v: "+380 67 446 3626", href: "tel:+380674463626" },
          { l: "WhatsApp", v: "+380 67 446 3626", href: "https://wa.me/380674463626" },
          { l: "Сайт", v: "zimenko.ua", href: "https://zimenko.ua" },
          { l: "Адреса", v: "бул. Лесі Українки, 11, Київ, 01133", href: null },
        ].map((it, i) => (
          <div key={it.l} className="reveal" data-delay={i * 80}
            style={{
              borderBottom: `1px solid ${C.line}`, padding: "20px 0",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted }}>{it.l}</span>
            {it.href
              ? <a href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined}
                  style={{ fontFamily: "'Jost',sans-serif", fontSize: 15, color: C.white, textDecoration: "none", transition: "color .3s" }}
                  onMouseEnter={e => e.target.style.color = C.champagne}
                  onMouseLeave={e => e.target.style.color = C.white}
                >{it.v}</a>
              : <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 15, color: C.white }}>{it.v}</span>
            }
          </div>
        ))}

        {/* Hours */}
        <div className="reveal" style={{ marginTop: 40 }}>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: C.champagne, marginBottom: 16 }}>
            Графік роботи
          </div>
          {[
            ["Пн–Пт", "09:00–20:30"],
            ["Субота", "10:00–19:00"],
            ["Неділя", "Закрито"],
          ].map(([d, t]) => (
            <div key={d} style={{
              display: "flex", justifyContent: "space-between",
              padding: "10px 0", borderBottom: `1px solid ${C.line}`,
            }}>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: C.muted }}>{d}</span>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: t === "Закрито" ? C.muted : C.champagne }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ padding: "100px 72px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h3 className="reveal" style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 32, fontWeight: 300, color: C.white, marginBottom: 40,
        }}>
          Розкажіть про ваш<br /><em style={{ color: C.champagne }}>проєкт</em>
        </h3>

        {sent ? (
          <div style={{
            fontFamily: "'Cormorant Garamond',serif", fontSize: 22,
            fontStyle: "italic", color: C.champagne, textAlign: "center",
            padding: "60px 0", animation: "fadeInUp .8s forwards",
          }}>
            Дякуємо. Ми зв'яжемося з вами найближчим часом.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div className="reveal">
              <label style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted, display: "block", marginBottom: 8 }}>
                Ваше ім'я
              </label>
              <input className="z-input" type="text" placeholder="Ім'я та прізвище"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="reveal" data-delay="80">
              <label style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted, display: "block", marginBottom: 8 }}>
                Телефон або Email
              </label>
              <input className="z-input" type="text" placeholder="+380 або email"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="reveal" data-delay="160">
              <label style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: C.muted, display: "block", marginBottom: 8 }}>
                Про проєкт
              </label>
              <textarea className="z-input" rows={4} placeholder="Тип об'єкту, площа, побажання..."
                value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required />
            </div>
            <div className="reveal" data-delay="200">
              <button type="submit" style={{
                width: "100%", background: "transparent",
                border: `1px solid ${C.champLine}`,
                color: C.champagne, padding: "16px",
                fontFamily: "'Jost',sans-serif", fontSize: 11,
                letterSpacing: "0.28em", textTransform: "uppercase",
                cursor: "none", transition: "all .35s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = C.champagne; e.currentTarget.style.color = C.black; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.champagne; }}
              >
                Надіслати запит
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{
      background: C.dark, borderTop: `1px solid ${C.line}`,
      padding: "48px 80px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: 24,
    }}>
      <div>
        <div style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 20, fontWeight: 400, letterSpacing: "0.1em", color: C.white,
        }}>
          Yuriy <span style={{ color: C.champagne }}>Zimenko</span>
        </div>
        <div style={{
          fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.32em",
          textTransform: "uppercase", color: C.muted, marginTop: 3,
        }}>
          Design Studio · Kyiv
        </div>
      </div>

      <div style={{ display: "flex", gap: 32 }}>
        {["Проєкти", "Послуги", "Студія", "Контакти"].map(l => (
          <a key={l} href={`#${l === "Студія" ? "studio" : l === "Проєкти" ? "projects" : l === "Послуги" ? "services" : "contact"}`}
            style={{
              fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: C.muted, textDecoration: "none", transition: "color .3s",
            }}
            onMouseEnter={e => e.target.style.color = C.champagne}
            onMouseLeave={e => e.target.style.color = C.muted}
          >{l}</a>
        ))}
      </div>

      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>
        © 2026 zimenko.ua
      </div>
    </footer>
  );
}

/* ─── APP ───────────────────────────────────────────────────── */
export default function App() {
  // Inject global CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useReveal();

  return (
    <div className="noise" id="top">
      <Cursor />
      <Nav />
      <Hero />
      <Manifesto />
      <Projects />
      <Services />
      <Studio />
      <Reviews />
      <Contact />
      <Footer />
    </div>
  );
}
