import { useEffect, useRef, useState, useCallback } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { OneEuroFilter } from "../utils/OneEuroFilter";

export type GestureState = "fist" | "open" | "none";

export interface HandData {
  side: "left" | "right";
  landmarks: { x: number; y: number }[];
  wrist: { x: number; y: number };
  pinch: number;
  extended: number;
  centroid: { x: number; y: number };
  indexTipZ: number;
}

export interface GestureRefs {
  gesture: GestureState;
  ready: boolean;
  loading: boolean;
  extendedFingers: number;
  isPointing: boolean;
  isPinching: boolean;
  isPoking: boolean;
  indexTip: { x: number; y: number } | null;
  handPos: { x: number; y: number } | null;
  rawHandPos: { x: number; y: number } | null;
  handVelocity: number;
  hands: HandData[];
  pinchDistance: number;
}

const TIPS = [4, 8, 12, 16, 20] as const;
const PIPS = [3, 6, 10, 14, 18] as const;

function countExtended(landmarks: { x: number; y: number }[]): number {
  const wrist = landmarks[0]; let n = 0;
  const tipD = Math.hypot(landmarks[4].x - wrist.x, landmarks[4].y - wrist.y);
  const ipD = Math.hypot(landmarks[3].x - wrist.x, landmarks[3].y - wrist.y);
  if (tipD > ipD * 1.08) n++;
  for (let i = 1; i < 5; i++) {
    const tipDist = Math.hypot(landmarks[TIPS[i]].x - wrist.x, landmarks[TIPS[i]].y - wrist.y);
    const pipDist = Math.hypot(landmarks[PIPS[i]].x - wrist.x, landmarks[PIPS[i]].y - wrist.y);
    if (tipDist > pipDist * 1.04) n++;
  }
  return n;
}

function isPointingGesture(landmarks: { x: number; y: number }[]): { pointing: boolean; indexTip: { x: number; y: number } | null } {
  const wrist = landmarks[0];
  const tipToWrist = (i: number) => Math.hypot(landmarks[i].x - wrist.x, landmarks[i].y - wrist.y);
  const indexExtended = tipToWrist(8) > tipToWrist(6) * 1.03;
  const middleFolded = !(tipToWrist(12) > tipToWrist(10) * 1.03);
  const ringFolded = !(tipToWrist(16) > tipToWrist(14) * 1.03);
  const pinkyFolded = !(tipToWrist(20) > tipToWrist(18) * 1.03);
  const pointing = indexExtended && middleFolded && ringFolded && pinkyFolded;
  return { pointing, indexTip: pointing ? { x: landmarks[8].x, y: landmarks[8].y } : null };
}

function pinchDist(landmarks: { x: number; y: number }[]): number {
  return Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
}
function identifySide(h: "Left" | "Right"): "left" | "right" {
  return h === "Left" ? "left" : "right";
}

class Smoother {
  v = 0; v2 = 0; init = false; a: number;
  constructor(a = 0.3) { this.a = a; }
  update(raw: number) {
    if (!this.init) { this.v = raw; this.v2 = raw; this.init = true; }
    else { this.v += (raw - this.v) * this.a; this.v2 += (this.v - this.v2) * this.a; }
    return this.v2;
  }
}


export function useHandGesture(enabled = false) {
  const refs = useRef<GestureRefs>({
    gesture: "none", ready: false, loading: true, extendedFingers: 0,
    isPointing: false, isPinching: false, isPoking: false, indexTip: null,
    handPos: null, rawHandPos: null, handVelocity: 0, hands: [], pinchDistance: 100,
  });

  const [uiState, setUiState] = useState({
    ready: false, loading: true, gesture: "none" as GestureState,
    extended: 0, handCount: 0, modelLoading: true,
  });

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cancelledRef = useRef(false);

  /* One Euro Filters for cursor (index tip) — smooth when slow, responsive when fast */
  const filterX = useRef(new OneEuroFilter(1.0, 0.0, 1.0));
  const filterY = useRef(new OneEuroFilter(1.0, 0.0, 1.0));
  /* Velocity smoother */
  const velEma = useRef(new Smoother(0.6));
  const prevX = useRef<number | null>(null);
  const lastTime = useRef(0);
  /* Gesture stability */
  const stableCnt = useRef(0);
  const lastExt = useRef(0);
  /* Pinch state filter (majority vote) */
  const pinchHistory = useRef<boolean[]>([]);
  const PINCH_HISTORY = 5;
  const PINCH_THRESHOLD = 0.04;
  /* point-and-hold click: when pointing fingertip stays still for HOLD_FRAMES, trigger click */
  const holdPos = useRef<{ x: number; y: number } | null>(null);
  const holdFrames = useRef(0);
  const HOLD_FRAMES = 7;
  const HOLD_RADIUS = 0.05;
  const holdCooldown = useRef(false);

  const detecting = useRef(false);
  let lastDetect = 0;
  const DETECT_MS = 33;

  const detect = useCallback(() => {
    const now = performance.now();
    if (now - lastDetect < DETECT_MS) return;
    lastDetect = now;

    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    if (!landmarker || !video || video.readyState < 2) return;
    detecting.current = true;

    try {
      const result = landmarker.detectForVideo(video, now);
      const r = refs.current;

      if (result.landmarks && result.landmarks.length > 0) {
        const handList: HandData[] = result.landmarks.map((lm, i) => {
          const pts = lm.map((k) => ({ x: k.x, y: k.y, z: (k as any).z ?? 0 }));
          return {
            side: identifySide(result.handedness[i]?.[0]?.categoryName as "Left" | "Right" ?? "Right"),
            landmarks: pts,
            wrist: { x: pts[0].x, y: pts[0].y },
            pinch: pinchDist(pts),
            extended: countExtended(pts),
            centroid: { x: pts[9].x, y: pts[9].y },
            indexTipZ: pts[8].z ?? 0,
          };
        });
        r.hands = handList;

        const primary = handList[0];

        /* dt for filters */
        const dt = lastTime.current ? Math.max((now - lastTime.current) / 1000, 0.016) : 0.016;
        lastTime.current = now;

        /* pointing detection */
        const pt = isPointingGesture(primary.landmarks);
        r.isPointing = pt.pointing;
        r.indexTip = pt.indexTip;

        /* One Euro Filter on index tip (or wrist fallback) */
        const rawX = pt.indexTip ? pt.indexTip.x : primary.wrist.x;
        const rawY = pt.indexTip ? pt.indexTip.y : primary.wrist.y;

        const smoothX = filterX.current.filter(rawX, dt);
        const smoothY = filterY.current.filter(rawY, dt);

        /* cursor mapping: X flipped for mirror, centered */
        const cursorX = 1 - smoothX;
        const cursorY = smoothY;
        r.rawHandPos = { x: cursorX, y: cursorY };
        r.handPos = r.rawHandPos;
        r.pinchDistance = primary.pinch;
        r.extendedFingers = primary.extended;

        /* pinch state filter */
        const isPinched = primary.pinch < PINCH_THRESHOLD && pt.pointing;
        pinchHistory.current.push(isPinched);
        if (pinchHistory.current.length > PINCH_HISTORY) pinchHistory.current.shift();
        r.isPinching = pinchHistory.current.filter((v) => v).length >= 3;

        /* === Point-and-Hold Click Detection (Vision Pro style) ===
           When pointing, track fingertip position. If it stays within HOLD_RADIUS
           for HOLD_FRAMES consecutive frames, fire a click. This is far more reliable
           than Z-axis depth estimation which MediaPipe cannot accurately provide. */
        if (pt.pointing && pt.indexTip && !holdCooldown.current) {
          const tip = pt.indexTip;
          if (holdPos.current) {
            const dist = Math.hypot(tip.x - holdPos.current.x, tip.y - holdPos.current.y);
            if (dist < HOLD_RADIUS) {
              holdFrames.current++;
              if (holdFrames.current >= HOLD_FRAMES) {
                r.isPoking = true;
                holdFrames.current = 0;
                holdPos.current = null;
                holdCooldown.current = true;
                setTimeout(() => { holdCooldown.current = false; }, 800);
              }
            } else {
              holdPos.current = { x: tip.x, y: tip.y };
              holdFrames.current = 0;
              r.isPoking = false;
            }
          } else {
            holdPos.current = { x: tip.x, y: tip.y };
            holdFrames.current = 0;
            r.isPoking = false;
          }
        } else {
          holdPos.current = null;
          holdFrames.current = 0;
          r.isPoking = false;
        }

        /* velocity for rotation */
        const kx = r.rawHandPos.x;
        if (prevX.current !== null) {
          const rawVel = (kx - prevX.current!) / dt;
          r.handVelocity = velEma.current.update(rawVel);
        }
        prevX.current = kx;

        /* gesture classification */
        const ext = primary.extended;
        if (ext === lastExt.current) {
          stableCnt.current++;
          if (stableCnt.current >= 2) {
            r.extendedFingers = ext;
            r.gesture = ext <= 2 ? "fist" : ext >= 4 ? "open" : "none";
          }
        } else { lastExt.current = ext; stableCnt.current = 1; r.extendedFingers = ext; }
      } else {
        r.hands = [];
        r.handVelocity *= 0.85;
        r.isPinching = false;
        r.isPoking = false;
        pinchHistory.current = [];
        lastExt.current = 0; stableCnt.current = 0;
      }

      const prev = uiState;
      const cur = { ready: true, loading: false, modelLoading: false, gesture: r.gesture, extended: r.extendedFingers, handCount: r.hands.length };
      if (cur.ready !== prev.ready || cur.loading !== prev.loading || cur.gesture !== prev.gesture || cur.extended !== prev.extended || cur.handCount !== prev.handCount) {
        setUiState(cur);
      }
    } catch { /* skip */ }
    finally { detecting.current = false; }
  }, [uiState]);

  const draw = useCallback(() => {}, []);

  useEffect(() => {
    if (!enabled) {
      refs.current.ready = false;
      refs.current.loading = false;
      setUiState({ ready: false, loading: false, modelLoading: false, gesture: "none", extended: 0, handCount: 0 });
      return;
    }
    cancelledRef.current = false;

    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1";
    document.body.appendChild(video);
    videoRef.current = video;

    (async () => {
      try {
        console.log("[MediaPipe] loading HandLandmarker...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        if (cancelledRef.current) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.7,
        });
        if (cancelledRef.current) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;
        console.log("[MediaPipe] model ready");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
        await video.play();
        console.log("[MediaPipe] camera on");

        refs.current.ready = true;
        refs.current.loading = false;
        setUiState({ ready: true, loading: false, modelLoading: false, gesture: "none", extended: 0, handCount: 0 });
      } catch (err: any) {
        console.warn("[MediaPipe] init fail:", err.message);
        refs.current.loading = false;
        setUiState({ ready: false, loading: false, modelLoading: false, gesture: "none", extended: 0, handCount: 0 });
      }
    })();

    return () => {
      cancelledRef.current = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      (video.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
      video.remove();
      videoRef.current = null;
    };
  }, [enabled]);

  return { refs, uiState, detect, draw };
}