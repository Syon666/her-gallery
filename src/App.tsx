import React, { Component, useEffect, useState, useRef } from "react";
import { usePhotoStore } from "./store/usePhotoStore";
import { useHandGesture } from "./hooks/useHandGesture";
import type { Photo } from "./types/photo";
import Starfield from "./components/Starfield";
import CosmicRing from "./components/CosmicRing";
import UploadButton from "./components/UploadButton";
import DateFilter from "./components/DateFilter";

class ErrorBoundary extends Component<{ children: React.ReactNode; fb?: React.ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? (this.props.fb ?? <div className="h-screen flex items-center justify-center text-[#7060a0] text-sm">oops</div>) : this.props.children; }
}

import Galaxy3D from "./components/Galaxy3D";

type ViewMode = "2d" | "3d";

/* ?? nonlinear velocity mapping ?? */
function nln(v: number): number {
  const s = Math.sign(v), a = Math.abs(v);
  return s * Math.pow(a, 0.65) * 1.1;
}

function App() {
  const init = usePhotoStore((s) => s.init);
  const loading = usePhotoStore((s) => s.loading);
  const filtered = usePhotoStore((s) => s.getFilteredPhotos());
  const [zoomedPhoto, setZoomedPhoto] = useState<Photo | null>(null);
  const zoomedPhotoRef = useRef(zoomedPhoto);
  useEffect(() => { zoomedPhotoRef.current = zoomedPhoto; }, [zoomedPhoto]);
  const toggleFavorite = usePhotoStore((s) => s.toggleFavorite);
  const clearAllPhotos = usePhotoStore((s) => s.clearAllPhotos);

  const [mode, setMode] = useState<ViewMode>("2d");
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  /* ?? gesture (tick-based, no internal rAF) ?? */
  const { refs: gRefs, uiState: gUI, detect, draw } = useHandGesture(mode === "3d");

  /* ?? refs for animation ?? */
  const spinRef = useRef(0);
  const zoomRef = useRef(1);
  const palmArmedRef = useRef(false);
  const armFrames = useRef(0);
  const handWorldPosRef = useRef<{ x: number; y: number } | null>(null);
  const showVirtualHandRef = useRef(true);
  const pointingRef = useRef(false);
  const pinchingRef = useRef(false);
  const pokingRef = useRef(false);

  /* ?? single animation loop ?? */
  const tickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();

    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.15);
      lastT = now;

      if (modeRef.current === "3d") {
        /* 1. gesture detection */
        detect();
        /* 2. canvas draw */
        draw();
      }


      /* sync gesture refs for 3D components */
      pointingRef.current = gRefs.current.isPointing;
      pinchingRef.current = gRefs.current.isPinching;
      pokingRef.current = gRefs.current.isPoking;

      /* fist closes zoom overlay */
      if (zoomedPhotoRef.current && gRefs.current.gesture === "fist") {
        setZoomedPhoto(null);
      }

      /* 3. spin engine */
      const isOpen = gRefs.current.extendedFingers >= 4;
      if (isOpen) { armFrames.current++; if (armFrames.current >= 2) palmArmedRef.current = true; }
      else { armFrames.current = 0; palmArmedRef.current = false; }

      /* pointing = stop rotation immediately */
      if (gRefs.current.isPointing) {
        spinRef.current *= Math.exp(-dt / 0.3);
        if (Math.abs(spinRef.current) < 0.001) spinRef.current = 0;
      } else if (palmArmedRef.current) {
        const impulse = nln(gRefs.current.handVelocity * -5.0);
        if (Math.abs(impulse) > 0.012) {
          spinRef.current += impulse;
          spinRef.current = Math.max(-2.5, Math.min(2.5, spinRef.current));
        }
        spinRef.current *= Math.exp(-dt / 6);
      } else {
        spinRef.current *= Math.exp(-dt / 1.5);
        if (Math.abs(spinRef.current) < 0.0003) spinRef.current = 0;
      }

      /* update gesture refs for 3D */
      /* virtual cursor: index tip when pointing, wrist otherwise (Vision Pro style) */
      const tip = gRefs.current.indexTip;
      const wrist = gRefs.current.rawHandPos;
      const cursor = (tip && gRefs.current.isPointing) ? tip : wrist;
      handWorldPosRef.current = cursor ? { x: (cursor.x - 0.5) * 12, y: (0.5 - cursor.y) * 8 } : null;
      const hands = gRefs.current.hands;
      const rh = hands.find((h) => h.side === "right") ?? hands[0];
      if (rh) {
        const base = 0.08; /* reference pinch distance */
        zoomRef.current += (base / Math.max(rh.pinch, 0.02) - zoomRef.current) * 0.28;
        zoomRef.current = Math.max(0.3, Math.min(4, zoomRef.current));
      }

      raf = requestAnimationFrame(tick);
    }

    tickRef.current = tick;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [detect, draw, gRefs]);

  /* hotkeys */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) { e.preventDefault(); setMode((m) => (m === "2d" ? "3d" : "2d")); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  /* Escape to close zoom overlay */
  useEffect(() => {
    if (!zoomedPhoto) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomedPhoto(null); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [zoomedPhoto]);

  useEffect(() => { init().catch((err: any) => console.error("[App] init failed:", err)); }, [init]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-[#07071a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-[#b8a0ff] border-t-transparent animate-spin" />
        <p className="text-[#7060a0] text-xs">loading...</p>
      </div>
    </div>;
  }

  const { gesture, handCount, modelLoading: gLoading, ready } = gUI;

  return (
    <div className="h-dvh w-dvw overflow-hidden bg-[#07071a] relative select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Starfield />

      {mode === "3d" && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-2xl bg-[rgba(12,8,36,0.45)] backdrop-blur-2xl border border-[rgba(140,120,220,0.1)] shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex items-center gap-2 text-[10px] tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full transition-all duration-500"
            style={{
              background: gesture === "open" ? "#b8a0ff" : gesture === "fist" ? "#ff7060" : handCount > 0 ? "#60a0ff" : "#403060",
              boxShadow: `0 0 10px ${gesture === "open" ? "#b8a0ff" : gesture === "fist" ? "#ff7060" : handCount > 0 ? "#60a0ff" : "transparent"}`
            }} />
          <span className="text-[#9080b0] font-light">
            {gLoading ? "Loading..." : !ready ? "Switch to 3D" :
             zoomedPhoto ? "Fist to close" :
             gesture === "open" ? (Math.abs(spinRef.current) > 0.01 ? "Fan to spin" : "Open palm - fan to rotate") :
             gesture === "fist" ? "Fist - sphere" :
             handCount > 0 ? "Hand detected" : "Waiting for hand"}
          </span>
          <span className="w-px h-3 bg-[rgba(120,100,200,0.1)]" />
          <span className="text-[#504070] font-light uppercase">{mode} ? space</span>
        </div>
      )}

      {/* header ? refined glass morphism */}
      <header className="absolute top-0 inset-x-0 z-40">
        <div className="mx-4 mt-3 px-5 py-2.5 rounded-2xl bg-[rgba(12,8,36,0.55)] backdrop-blur-2xl border border-[rgba(140,120,220,0.1)] shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex items-center justify-between">
          <h1 className="text-[15px] font-light tracking-[0.15em] flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#b8a0ff] shadow-[0_0_8px_#b8a0ff]" />
            <span className="text-[#d0c8f0]">HER</span>
            <span className="text-[#7060a0] font-extralight">GALLERY</span>
          </h1>
          <div className="flex items-center gap-2">
            <DateFilter />
            <UploadButton />
            {filtered.length > 0 && (
              <>
                <div className="w-px h-5 bg-[rgba(120,100,200,0.1)]" />
                <button onClick={() => setMode((m) => (m === "2d" ? "3d" : "2d"))}
                  className="text-[11px] tracking-wider text-[#7060a0] hover:text-[#b8a0ff] transition-all duration-300 cursor-pointer uppercase hover:tracking-[0.15em]">
                  {mode === "2d" ? "3D" : "2D"}
                </button>
                <button onClick={() => { if (confirm("clear all?")) clearAllPhotos(); }}
                  className="text-[10px] text-[#504060] hover:text-[#ff7060] transition-colors duration-300 cursor-pointer uppercase tracking-wider">
                  clear
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* main */}
      <div className="absolute inset-0 z-10">
        {filtered.length === 0 ? (
          <div className="h-screen flex flex-col items-center justify-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[rgba(140,120,220,0.04)] border border-[rgba(140,120,220,0.08)] flex items-center justify-center">
                <span className="text-3xl opacity-20">?</span>
              </div>
              <div className="absolute inset-0 rounded-full border border-[rgba(140,120,220,0.04)] animate-ping" style={{ animationDuration: "3s" }} />
            </div>
            <div className="text-center">
              <p className="text-[#605080] text-sm font-light tracking-widest uppercase">Empty Gallery</p>
              <p className="text-[#403060] text-xs mt-1 font-light">click upload above to add photos</p>
            </div>
          </div>
        ) : mode === "3d" ? (
          <ErrorBoundary fb={<div className="h-screen flex flex-col items-center justify-center gap-4"><span className="text-3xl opacity-30">!</span><p className="text-[#604080] text-sm">3D error, space for 2D</p></div>}>
              <Galaxy3D photos={filtered} onPhotoClick={setZoomedPhoto} morphFactor={1 - gUI.extended / 5}
                handRotationRef={spinRef}
                zoomRef={zoomRef} handWorldPosRef={handWorldPosRef}
                showVirtualHandRef={showVirtualHandRef}
                pointingRef={pointingRef} pinchingRef={pinchingRef} pokingRef={pokingRef} />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary fb={<div className="h-screen flex flex-col items-center justify-center gap-4"><span className="text-3xl opacity-30">!</span><p className="text-[#604080] text-sm">2D error</p></div>}>
            <CosmicRing photos={filtered} onPhotoClick={setZoomedPhoto} onToggleFavorite={toggleFavorite} />
          </ErrorBoundary>
        )}
      </div>

      {/* unified zoom overlay with swipe navigation */}
      {zoomedPhoto ? (() => {
        const idx = filtered.findIndex((p: Photo) => p.id === zoomedPhoto.id);
        const total = filtered.length;
        const prevPhoto = idx > 0 ? filtered[idx - 1] : null;
        const nextPhoto = idx < total - 1 ? filtered[idx + 1] : null;
        const swipeRef: React.MutableRefObject<{ sx: number; sy: number } | null> = { current: null };

        const doSwipe = (dx: number) => {
          if (Math.abs(dx) > 50) {
            if (dx > 0 && prevPhoto) setZoomedPhoto(prevPhoto);
            else if (dx < 0 && nextPhoto) setZoomedPhoto(nextPhoto);
          }
        };

        return React.createElement("div", {
          onClick: () => setZoomedPhoto(null),
          onMouseDown: (e: any) => { swipeRef.current = { sx: e.clientX, sy: e.clientY }; },
          onMouseUp: (e: any) => { if (swipeRef.current) { doSwipe(e.clientX - swipeRef.current.sx); swipeRef.current = null; } },
          onTouchStart: (e: any) => { const t = e.touches[0]; swipeRef.current = { sx: t.clientX, sy: t.clientY }; },
          onTouchEnd: (e: any) => { if (swipeRef.current) { const t = e.changedTouches[0]; doSwipe(t.clientX - swipeRef.current.sx); swipeRef.current = null; } },
          style: {
            position: "fixed", inset: 0, zIndex: 70,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(5,4,18,0.94)", cursor: "pointer",
          }
        },
          React.createElement("style", null, "@keyframes scaleUp{from{transform:scale(0.3);opacity:0}to{transform:scale(1);opacity:1}}"),
          React.createElement("img", {
            src: zoomedPhoto.url, alt: zoomedPhoto.title || "",
            draggable: false,
            style: { maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 0 100px rgba(120,80,220,0.12)", animation: "scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)", pointerEvents: "none" }
          }),
          /* counter */
          total > 1 ? React.createElement("div", {
            style: { position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", padding: "4px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 300, letterSpacing: "0.06em" }
          }, `${idx + 1} / ${total}`) : null,
          /* prev arrow */
          prevPhoto ? React.createElement("button", {
            onClick: (e: any) => { e.stopPropagation(); setZoomedPhoto(prevPhoto); },
            style: { position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" },
            onMouseEnter: (e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; },
            onMouseLeave: (e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; },
          }, "\u2039") : null,
          /* next arrow */
          nextPhoto ? React.createElement("button", {
            onClick: (e: any) => { e.stopPropagation(); setZoomedPhoto(nextPhoto); },
            style: { position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" },
            onMouseEnter: (e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; },
            onMouseLeave: (e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; },
          }, "\u203a") : null,
          /* info bar */
          React.createElement("div", {
            style: { position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", padding: "6px 18px", borderRadius: 14, background: "rgba(15,12,40,0.5)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.04)" },
            onClick: (e: any) => e.stopPropagation(),
          },
            React.createElement("span", { style: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 300, letterSpacing: "0.04em" } }, zoomedPhoto.title || "untitled"),
            zoomedPhoto.date ? React.createElement("span", { style: { fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 12, fontWeight: 300 } }, new Date(zoomedPhoto.date).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })) : null,
          ),
          /* close button */
          React.createElement("button", {
            onClick: (e: any) => { e.stopPropagation(); setZoomedPhoto(null); },
            style: { position: "absolute", top: 28, right: 28, width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" },
            onMouseEnter: (e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; },
            onMouseLeave: (e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; },
          }, "\u2715")
        );
      })() : null}
    </div>
  );
}

export default App;
