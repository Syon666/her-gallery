import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { usePhotoStore } from "../store/usePhotoStore";
import type { Photo } from "../types/photo";

const LAYOUT_KEY = "cosmic-layout-2d";

interface RingConfig { a: number; b: number; count: number; offset: number; cardScale: number }
interface RingData { config: RingConfig; cards: { photo: Photo; angle: number }[] }

function buildRings(total: number, maxR: number, ratio: number): RingData[] {
  function ring(c: number, r: number, s: number, n: number, o: number): RingData {
    const cards: { photo: Photo; angle: number }[] = [];
    for (let i = 0; i < n; i++) cards.push({ photo: null as unknown as Photo, angle: (2 * Math.PI * i) / c + o });
    return { config: { a: r, b: r * ratio, count: c, offset: o, cardScale: s }, cards };
  }
  if (total <= 3) return [ring(3, maxR * 0.22, 0.9, total, 0)];
  if (total <= 8) { const n1 = Math.ceil(total * 0.4); return [ring(n1, maxR * 0.16, 0.84, n1, 0), ring(total - n1, maxR * 0.48, 0.74, total - n1, Math.PI / n1)]; }
  if (total <= 18) { const n1 = Math.ceil(total * 0.2), n2 = Math.ceil(total * 0.35); return [ring(n1, maxR * 0.1, 0.8, n1, 0), ring(n2, maxR * 0.34, 0.7, n2, Math.PI / n1), ring(total - n1 - n2, maxR * 0.66, 0.56, total - n1 - n2, Math.PI / n2)]; }
  if (total <= 35) { const n1 = Math.ceil(total * 0.1), n2 = Math.ceil(total * 0.2), n3 = Math.ceil(total * 0.3); return [ring(n1, maxR * 0.07, 0.78, n1, 0), ring(n2, maxR * 0.26, 0.67, n2, Math.PI / n1), ring(n3, maxR * 0.5, 0.56, n3, Math.PI / n2), ring(total - n1 - n2 - n3, maxR * 0.76, 0.46, total - n1 - n2 - n3, Math.PI / n3)]; }
  const n1 = Math.min(3, Math.ceil(total * 0.06)), n2 = Math.ceil(total * 0.13), n3 = Math.ceil(total * 0.21), n4 = Math.ceil(total * 0.27);
  return [ring(n1, maxR * 0.05, 0.76, n1, 0), ring(n2, maxR * 0.2, 0.66, n2, Math.PI / n1), ring(n3, maxR * 0.4, 0.54, n3, Math.PI / n2), ring(n4, maxR * 0.62, 0.44, n4, Math.PI / n3), ring(total - n1 - n2 - n3 - n4, maxR * 0.86, 0.35, total - n1 - n2 - n3 - n4, Math.PI / n4)];
}

function loadLayout(): Record<string, { x: number; y: number }> | null {
  try { const r = localStorage.getItem(LAYOUT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveLayout(m: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(m)); } catch {}
}

/* draggable photo card */
function PhotoCard({ photo, baseX, baseY, cardW, cardScale, zoomRef, customOffset, onPhotoClick, onToggleFavorite, onDelete, onDragEnd }: {
  photo: Photo; baseX: number; baseY: number; cardW: number; cardScale: number;
  zoomRef: { current: number }; customOffset: { x: number; y: number };
  onPhotoClick: (p: Photo) => void; onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void; onDragEnd: (ox: number, oy: number) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const start = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const dragging = useRef(false);
  const wasDragged = useRef(false);
  const rafId = useRef(0);
  const moveAcc = useRef({ dx: 0, dy: 0 });

  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    start.current = { mx: e.clientX, my: e.clientY, ox: customOffset.x, oy: customOffset.y };
    dragging.current = true; wasDragged.current = false;
    moveAcc.current = { dx: 0, dy: 0 };
    if (divRef.current) {
      divRef.current.style.transition = "none"; divRef.current.style.zIndex = "50";
      divRef.current.style.filter = "drop-shadow(0 12px 36px rgba(184,160,255,0.35))";
    }
    const z = zoomRef.current || 1;
    const flush = () => {
      rafId.current = 0;
      if (!divRef.current) return;
      const { dx, dy } = moveAcc.current;
      const ox = customOffset.x + dx / z, oy = customOffset.y + dy / z;
      divRef.current.style.transform = "translate3d(" + (baseX + ox - cardW / 2).toFixed(1) + "px, " + (baseY + oy - cardW * 0.66).toFixed(1) + "px, 0) scale(" + (cardScale * 1.08) + ")";
    };
    const move = (ev: MouseEvent) => {
      const dist = Math.hypot(ev.clientX - start.current.mx, ev.clientY - start.current.my);
      if (dist > 3) wasDragged.current = true;
      moveAcc.current = { dx: ev.clientX - start.current.mx, dy: ev.clientY - start.current.my };
      if (!rafId.current) rafId.current = requestAnimationFrame(flush);
    };
    const up = (ev: MouseEvent) => {
      dragging.current = false;
      if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
      if (divRef.current) {
        divRef.current.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
        divRef.current.style.zIndex = ""; divRef.current.style.filter = "";
        const ox = customOffset.x + (ev.clientX - start.current.mx) / z;
        const oy = customOffset.y + (ev.clientY - start.current.my) / z;
        divRef.current.style.transform = "translate3d(" + (baseX + ox - cardW / 2).toFixed(1) + "px, " + (baseY + oy - cardW * 0.66).toFixed(1) + "px, 0) scale(" + cardScale + ")";
      }
      if (wasDragged.current) {
        const dx = (ev.clientX - start.current.mx) / z, dy = (ev.clientY - start.current.my) / z;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) onDragEnd(customOffset.x + dx, customOffset.y + dy);
      }
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const tx = baseX + customOffset.x - cardW / 2;
  const ty = baseY + customOffset.y - cardW * 0.66;

  return React.createElement("div", {
    ref: divRef,
    style: {
      position: "absolute",
      transform: "translate3d(" + tx.toFixed(1) + "px, " + ty.toFixed(1) + "px, 0) scale(" + cardScale + ")",
      width: cardW, touchAction: "none",
      transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      cursor: "grab",
    },
    onMouseDown: onDown,
  },
    /* glow */
    React.createElement("div", {
      style: {
        position: "absolute", inset: -10, borderRadius: 20, pointerEvents: "none",
        background: "radial-gradient(circle, rgba(160,130,240,0.3) 0%, transparent 65%)",
        opacity: 0, transition: "opacity 0.4s",
      },
      onMouseEnter: (e: any) => { e.currentTarget.style.opacity = "1"; },
      onMouseLeave: (e: any) => { e.currentTarget.style.opacity = "0"; },
    }),
    /* card */
    React.createElement("div", {
      onClick: (e: any) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (wasDragged.current) { wasDragged.current = false; return; }
        onPhotoClick(photo);
      },
      style: {
        position: "relative", width: "100%", borderRadius: 14, overflow: "hidden",
        background: "rgba(30,30,65,0.5)", border: "1px solid rgba(120,100,200,0.2)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)", transition: "box-shadow 0.4s, border-color 0.4s",
      },
      onMouseEnter: (e: any) => { e.currentTarget.style.borderColor = "rgba(160,130,240,0.5)"; e.currentTarget.style.boxShadow = "0 16px 48px rgba(120,80,220,0.15)"; },
      onMouseLeave: (e: any) => { e.currentTarget.style.borderColor = "rgba(120,100,200,0.2)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)"; },
    },
      React.createElement("img", {
        src: photo.url, alt: photo.title || "", draggable: false,
        style: { width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block", pointerEvents: "none" }
      }),
      React.createElement("div", {
        style: { position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(8,6,24,0.9), transparent)", padding: "16px 10px 8px" }
      },
        React.createElement("p", {
          style: { margin: 0, fontSize: 9, color: "#c8c0e8", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.05em", fontWeight: 300 }
        }, photo.title || "untitled")
      ),
      React.createElement("button", {
        onClick: (e: any) => { e.stopPropagation(); if (confirm("delete?")) onDelete(photo.id); },
        style: { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.15)", fontSize: 9, opacity: 0, transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "center" },
        onMouseEnter: (e: any) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(255,60,60,0.3)"; e.currentTarget.style.color = "#ff8080"; },
        onMouseLeave: (e: any) => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.background = "rgba(0,0,0,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.15)"; },
      }, "\u2715"),
      React.createElement("button", {
        onClick: (e: any) => { e.stopPropagation(); onToggleFavorite(photo.id); },
        style: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", background: photo.favorited ? "rgba(255,150,180,0.25)" : "rgba(0,0,0,0.15)", color: photo.favorited ? "#ffb0c0" : "rgba(255,255,255,0.1)", fontSize: 12, opacity: photo.favorited ? 1 : 0, transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: photo.favorited ? "0 0 12px rgba(255,140,170,0.3)" : "none" },
        onMouseEnter: (e: any) => { e.currentTarget.style.opacity = "1"; },
        onMouseLeave: (e: any) => { if (!photo.favorited) e.currentTarget.style.opacity = "0"; },
      }, photo.favorited ? "\u2665" : "\u2661"),
    )
  );
}

/* main */
export default function CosmicRing({ photos, onPhotoClick, onToggleFavorite }: {
  photos: Photo[]; onPhotoClick: (p: Photo) => void; onToggleFavorite: (id: string) => void;
}) {
  const deletePhoto = usePhotoStore((s) => s.deletePhoto);
  const ctRef = useRef<HTMLDivElement>(null);
  const zoom = useRef(1);
  const off = useRef({ x: 0, y: 0 });
  const panStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const panning = useRef(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [dim, setDim] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [customPos, setCustomPos] = useState<Record<string, { x: number; y: number }>>(() => loadLayout() ?? {});
  const hasCustom = Object.keys(customPos).length > 0;

  useEffect(() => { const r = () => setDim({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);

  const ringData = useMemo(() => {
    if (photos.length === 0) return [];
    const maxR = Math.min(dim.w * 0.98, dim.h * 0.98) / 2;
    const ratio = Math.max((dim.w * 0.98) / (dim.h * 0.98), 1.0);
    const rings = buildRings(photos.length, maxR, ratio);
    let idx = 0;
    for (const r of rings) for (let i = 0; i < r.cards.length && idx < photos.length; i++, idx++) r.cards[i] = { photo: photos[idx], angle: r.cards[i].angle };
    return rings;
  }, [photos, dim]);

  const onPanDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, img, [style*=\"grab\"]")) return;
    panning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, ox: off.current.x, oy: off.current.y };
  };
  const onPanMove = (e: React.MouseEvent) => {
    if (!panning.current) return;
    off.current = { x: panStart.current.ox + (e.clientX - panStart.current.mx), y: panStart.current.oy + (e.clientY - panStart.current.my) };
  };
  const onPanUp = () => { panning.current = false; };

  useEffect(() => {
    const el = ctRef.current; if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = Math.max(0.35, Math.min(3.0, zoom.current + (e.deltaY > 0 ? -0.07 : 0.07)));
      setZoomPct(Math.round(zoom.current * 100));
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  useEffect(() => {
    let raf = 0;
    function tick() {
      if (ctRef.current) {
        ctRef.current.style.transform = "translate(" + off.current.x.toFixed(1) + "px, " + off.current.y.toFixed(1) + "px) scale(" + zoom.current.toFixed(2) + ")";
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const resetLayout = useCallback(() => { setCustomPos({}); saveLayout({}); }, []);

  if (photos.length === 0) return null;

  return React.createElement(React.Fragment, null,
    React.createElement("div", {
      ref: ctRef,
      style: {
        position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "grab", touchAction: "none", transformOrigin: "center center",
      },
      onMouseDown: onPanDown, onMouseMove: onPanMove, onMouseUp: onPanUp, onMouseLeave: onPanUp,
    },
      ...ringData.map((ring: RingData, ri: number) =>
        React.createElement("div", {
          key: "o" + ri,
          style: { position: "absolute", top: "50%", left: "50%", width: ring.config.a * 2, height: ring.config.b * 2, marginLeft: -ring.config.a, marginTop: -ring.config.b, borderRadius: "50%", pointerEvents: "none", border: (ri === 0 ? "1px solid" : "0.4px dashed"), borderColor: ri === 0 ? "rgba(180,150,240,0.1)" : "rgba(100,70,170,0.025)" }
        })
      ),
      ...ringData.map((ring: RingData, ri: number) =>
        React.createElement("div", { key: "r" + ri, style: { position: "absolute", top: "50%", left: "50%", width: 0, height: 0 } },
          ...ring.cards.map(({ photo, angle }: any) => {
            if (!photo) return null;
            const cp = customPos[photo.id];
            const cardW = Math.round(140 * ring.config.cardScale + 65);
            const bx = cp ? cp.x : Math.cos(angle) * ring.config.a;
            const by = cp ? cp.y : Math.sin(angle) * ring.config.b;
            return React.createElement(PhotoCard, {
              key: photo.id, photo, baseX: bx, baseY: by, cardW, cardScale: ring.config.cardScale,
              zoomRef: zoom, customOffset: cp || { x: 0, y: 0 },
              onPhotoClick: (p: Photo) => { onPhotoClick(p); },
              onToggleFavorite, onDelete: deletePhoto,
              onDragEnd: (ox: number, oy: number) => {
                setCustomPos((prev) => { const next = { ...prev, [photo.id]: { x: ox, y: oy } }; saveLayout(next); return next; });
              },
            });
          })
        )
      ),
      React.createElement("div", {
        style: { position: "absolute", bottom: 28, right: 28, zIndex: 30, padding: "5px 12px", borderRadius: 16, background: "rgba(10,8,30,0.45)", backdropFilter: "blur(16px)", border: "1px solid rgba(140,120,220,0.06)", fontSize: 10, color: "#605080", fontWeight: 300, letterSpacing: "0.04em" }
      }, zoomPct + "%"),
      hasCustom ? React.createElement("button", {
        onClick: resetLayout,
        style: { position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 30, padding: "6px 16px", borderRadius: 16, background: "rgba(140,120,220,0.08)", backdropFilter: "blur(16px)", border: "1px solid rgba(140,120,220,0.1)", fontSize: 10, color: "#7060a0", cursor: "pointer", letterSpacing: "0.05em", fontWeight: 300, transition: "all 0.3s" },
        onMouseEnter: (e: any) => { e.currentTarget.style.background = "rgba(140,120,220,0.15)"; e.currentTarget.style.color = "#9080b0"; },
        onMouseLeave: (e: any) => { e.currentTarget.style.background = "rgba(140,120,220,0.08)"; e.currentTarget.style.color = "#7060a0"; },
      }, "reset layout") : null
    ),
  );
}
