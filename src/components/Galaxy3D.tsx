import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Photo } from "../types/photo";

interface Galaxy3DProps {
  photos: Photo[];
  onPhotoClick: (p: Photo) => void;
  morphFactor: number;
  handRotationRef: React.MutableRefObject<number>;
  zoomRef: React.MutableRefObject<number>;
  handWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  showVirtualHandRef: React.MutableRefObject<boolean>;
  pointingRef: React.MutableRefObject<boolean>;
  pinchingRef: React.MutableRefObject<boolean>;
  pokingRef: React.MutableRefObject<boolean>;
}

function ZoomController({ zoomRef }: { zoomRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const baseZ = useRef(8);
  useEffect(() => { baseZ.current = camera.position.z; }, []);
  useFrame(() => {
    const t = baseZ.current / Math.sqrt(Math.max(zoomRef.current, 0.3));
    camera.position.z += (t - camera.position.z) * 0.08;
  });
  return null;
}

function Stars() {
  const ref = useRef<THREE.Points>(null);
  useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) { p[i*3]=(Math.random()-0.5)*20; p[i*3+1]=(Math.random()-0.5)*20; p[i*3+2]=(Math.random()-0.5)*20; }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.015; });
  return React.createElement("points", { ref }, React.createElement("pointsMaterial", { size: 0.02, color: "#b8a0ff", transparent: true, opacity: 0.5, sizeAttenuation: true }));
}

function VirtualHand({ handWorldPosRef, showRef, pointingRef, pokingRef }: {
  handWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  showRef: React.MutableRefObject<boolean>;
  pointingRef: React.MutableRefObject<boolean>;
  pokingRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const outerGeo = useMemo(() => new THREE.TorusGeometry(0.1, 0.008, 8, 32), []);
  const innerGeo = useMemo(() => new THREE.TorusGeometry(0.06, 0.005, 8, 24), []);
  const dotGeo = useMemo(() => new THREE.SphereGeometry(0.025, 8, 8), []);
  const outerMat = useRef(new THREE.MeshBasicMaterial({ color: "#90a0ff", transparent: true, opacity: 0.25, depthWrite: false }));
  const innerMat = useRef(new THREE.MeshBasicMaterial({ color: "#c0c8ff", transparent: true, opacity: 0.35, depthWrite: false }));
  const dotMat = useRef(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false }));
  const targetX = useRef(0);
  const targetY = useRef(0);
  const curX = useRef(0);
  const curY = useRef(0);

  useFrame(() => {
    const h = handWorldPosRef.current;
    const show = showRef.current && !!h;
    if (h) { targetX.current = h.x; targetY.current = h.y; }
    // Smooth follow with lerp (reduces jitter)
    const lerp = 0.25;
    curX.current += (targetX.current - curX.current) * lerp;
    curY.current += (targetY.current - curY.current) * lerp;

    if (groupRef.current) {
      groupRef.current.visible = show;
      groupRef.current.position.set(curX.current, curY.current, 1);
    }

    const pok = pokingRef.current;
    const pt = pointingRef.current;

    outerMat.current.opacity = show ? (pok ? 0.6 : pt ? 0.45 : 0.25) : 0;
    outerMat.current.color.set(pok ? "#80ffa0" : pt ? "#ffc0a0" : "#90a0ff");
    innerMat.current.opacity = show ? (pok ? 0.7 : pt ? 0.55 : 0.35) : 0;
    innerMat.current.color.set(pok ? "#a0ffc0" : pt ? "#ffd0b0" : "#c0c8ff");
    dotMat.current.opacity = show ? (pok ? 0.9 : pt ? 0.7 : 0.5) : 0;

    const sc = pok ? 1.3 : pt ? 1.15 : 1;
    if (outerRingRef.current) outerRingRef.current.scale.setScalar(sc);
    if (innerRingRef.current) innerRingRef.current.scale.setScalar(sc);
  });
  return React.createElement("group", { ref: groupRef },
    React.createElement("mesh", { ref: outerRingRef, geometry: outerGeo, material: outerMat.current }),
    React.createElement("mesh", { ref: innerRingRef, geometry: innerGeo, material: innerMat.current }),
    React.createElement("mesh", { ref: dotRef, geometry: dotGeo, material: dotMat.current })
  );
}

function PhotoCard({ sharedCooldown, photo, targetPos, onClick, handWorldPosRef, pointingRef, pinchingRef }: {
  sharedCooldown: React.MutableRefObject<boolean>;
  photo: Photo; targetPos: [number,number,number]; onClick: () => void;
  handWorldPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  pointingRef: React.MutableRefObject<boolean>;
  pinchingRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pressing, setPressing] = useState(false);
  const worldPos = useRef(new THREE.Vector3());
  const scaleTarget = hovered ? 1.2 : 1;
  const scale = useRef(1);

  useFrame(() => {
    scale.current += (scaleTarget - scale.current) * 0.15;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scale.current * (pressing ? 1.05 : 1));
      groupRef.current.getWorldPosition(worldPos.current);
    }
    const h = handWorldPosRef.current;
    const isNear = h ? Math.hypot(worldPos.current.x - h.x, worldPos.current.y - h.y) < 1.0 : false;

    /* track distance to hand for nearest-photo selection */
    /* click: pointing + near + shared cooldown = open photo */
    if (pinchingRef.current && isNear && !sharedCooldown.current) {
      sharedCooldown.current = true;
      setPressing(true);
      setTimeout(() => { sharedCooldown.current = false; setPressing(false); }, 500);
      onClick();
    }

    if (glowRef.current) {
      const gm = (glowRef.current as any).material;
      const targetOpacity = (pointingRef.current && isNear) ? 0.5 : isNear ? 0.2 : 0.05;
      if (gm) gm.opacity += (targetOpacity - gm.opacity) * 0.15;
    }
  });

  useEffect(() => {
    if (!photo.url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photo.url;
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.needsUpdate = true;
      t.colorSpace = THREE.SRGBColorSpace;
      setTexture(t);
    };
    img.onerror = () => console.warn("[PhotoCard] texture load fail:", photo.id);
  }, [photo.url]);

  if (!texture) {
    return React.createElement("group", { position: targetPos },
      React.createElement("mesh", null,
        React.createElement("planeGeometry", { args: [0.8, 1.0] }),
        React.createElement("meshBasicMaterial", { color: "#302050", side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
      )
    );
  }

  const w = 1.0, h = w * (4/3);
  return React.createElement("group", { ref: groupRef, position: targetPos },
    React.createElement("mesh", {
      onPointerOver: (e: any) => { e.stopPropagation(); setHovered(true); },
      onPointerOut: () => setHovered(false),
      onClick: (e: any) => { e.stopPropagation(); onClick(); },
    },
      React.createElement("planeGeometry", { args: [w, h] }),
      React.createElement("meshPhysicalMaterial", { map: texture, side: THREE.DoubleSide, transparent: true, roughness: 0.4, metalness: 0.05, clearcoat: 0.1 })
    ),
    React.createElement("mesh", { ref: glowRef, position: [0,0,-0.02] },
      React.createElement("planeGeometry", { args: [w+0.5, h+0.5] }),
      React.createElement("meshBasicMaterial", { color: "#c8b0ff", side: THREE.DoubleSide, transparent: true, opacity: 0.05, depthWrite: false })
    )
  );
}

function RotatingGroup({ children, handRotationRef }: { children: React.ReactNode; handRotationRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += handRotationRef.current * Math.min(delta, 0.1) * 4.5; });
  return React.createElement("group", { ref }, children);
}

function fibPos(i: number, t: number, r: number): [number,number,number] {
  const phi = Math.acos(1-2*(i+0.5)/t);
  const theta = Math.PI*(1+Math.sqrt(5))*i;
  return [r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta)];
}
function ringPos(i: number, c: number, ri: number, rt: number, mr: number): [number,number,number] {
  const r = ((ri+1)/rt)*mr;
  const a = (2*Math.PI*i)/c+ri*0.5;
  return [Math.cos(a)*r, (Math.random()-0.5)*0.2, Math.sin(a)*r];
}
function rings(total: number): number[] {
  if (total<=4) return [total];
  if (total<=10) { const a=Math.ceil(total*0.35); return [a,total-a]; }
  if (total<=20) { const a=Math.ceil(total*0.2),b=Math.ceil(total*0.35); return [a,b,total-a-b]; }
  if (total<=40) { const a=Math.ceil(total*0.12),b=Math.ceil(total*0.22),c=Math.ceil(total*0.3); return [a,b,c,total-a-b-c]; }
  const a=Math.ceil(total*0.08),b=Math.ceil(total*0.15),c=Math.ceil(total*0.22),d=Math.ceil(total*0.28); return [a,b,c,d,total-a-b-c-d];
}
function lerp3(a:[number,number,number],b:[number,number,number],t:number):[number,number,number]{
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

export default function Galaxy3D({ photos, onPhotoClick, morphFactor, handRotationRef, zoomRef, handWorldPosRef, showVirtualHandRef, pointingRef, pinchingRef, pokingRef }: Galaxy3DProps) {
  const sharedCooldown = useRef(false);
  const ringCounts = useMemo(() => rings(photos.length), [photos.length]);
  const interpolated = useMemo(() => {
    const result: [number,number,number][] = [];
    let idx = 0;
    for (let ri = 0; ri < ringCounts.length; ri++) {
      for (let i = 0; i < ringCounts[ri]; i++) {
        if (idx >= photos.length) break;
        const s = fibPos(idx, photos.length, 3.5);
        const r = ringPos(i, ringCounts[ri], ri, ringCounts.length, 5.5);
        result.push(lerp3(s, r, morphFactor));
        idx++;
      }
    }
    return result;
  }, [photos.length, ringCounts, morphFactor]);


  return React.createElement(Canvas as any, {
    camera: { position: [0, 2, 8], fov: 60 },
    style: { position: "fixed", inset: 0, zIndex: 5 },
    gl: { antialias: true, alpha: true },
  },
    React.createElement("color", { attach: "background", args: ["#07071a"] }),
    React.createElement("ambientLight", { intensity: 0.5 }),
    React.createElement("pointLight", { position: [0, 6, 6], intensity: 0.8, color: "#b8a0ff" }),
    React.createElement("pointLight", { position: [5, -2, -3], intensity: 0.4, color: "#6040a0" }),
    React.createElement(Stars),
    React.createElement(ZoomController, { zoomRef }),
    React.createElement(VirtualHand, { handWorldPosRef, showRef: showVirtualHandRef, pointingRef, pokingRef }),
    React.createElement(RotatingGroup, { handRotationRef, children: photos.map((p, i) =>
        React.createElement(PhotoCard, {
          key: p.id, photo: p,
          targetPos: interpolated[i] || [0, 0, 0],
          onClick: () => onPhotoClick(p),
          sharedCooldown, handWorldPosRef, pointingRef, pinchingRef,
        })
      ) })
  );
}
