# 🌌 HER Gallery — 3D Hand Gesture Photo Gallery

> A cosmic-themed photo gallery with **hand gesture recognition**, 3D spatial layout, and immersive interaction.  
> Built for her. Built to impress.

![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite) ![Three.js](https://img.shields.io/badge/Three.js-R3F-black?logo=threedotjs) ![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-orange)

---

## ✨ Features

### 2D Cosmic Ring Mode
- Photos arranged in orbital rings like a mini galaxy
- **Drag to pan**, **wheel to zoom**, drag individual photos to reposition
- Layout persisted to localStorage
- Click any photo for full-screen zoom view

### 3D Hand Gesture Mode
- **Real-time hand tracking** via webcam + MediaPipe Hands (97% accuracy)
- 🖐️ Open palm → photos cluster into a **3D sphere**
- ✊ Fist → photos spread into **orbital rings**
- ☝️ Point at a photo → **instant open** (Vision Pro style)
- 🤏 Pinch to click | ✊ Fist to close | 👆 Swipe to navigate
- Virtual cursor follows fingertip with One Euro Filter smoothing
- Adaptive gain: slow movements for precision, fast for range

### Tech Highlights
| Category | Implementation |
|---|---|
| **Gesture Pipeline** | MediaPipe HandLandmarker → One Euro Filter → Kalman Filter → Adaptive Gain |
| **3D Engine** | React Three Fiber (R3F) + custom shader-free rendering |
| **State** | Zustand + IndexedDB persistence |
| **Performance** | Single rAF loop, ref-based hot paths, useMemo layout caching |
| **Smoothing** | Double-EMA for velocity, One Euro for cursor, Kalman for noise rejection |

---

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/her-gallery.git
cd her-gallery
npm install
npm run dev
```

Open `http://localhost:5173` — press **Space** to toggle 2D/3D mode.

---

## 🏗️ Architecture

```
src/
├── components/
│   ├── CosmicRing.tsx      # 2D orbital ring layout
│   ├── Galaxy3D.tsx        # 3D gesture-driven sphere/ring
│   ├── Starfield.tsx       # Canvas star background
│   ├── UploadButton.tsx    # Multi-photo upload with compression
│   ├── DateFilter.tsx      # Date range filter
│   └── Sidebar.tsx         # Style filter panel
├── hooks/
│   └── useHandGesture.ts   # MediaPipe + filters + gesture classification
├── store/
│   └── usePhotoStore.ts    # Zustand store + IndexedDB persistence
├── utils/
│   ├── OneEuroFilter.ts    # Speed-adaptive low-pass filter
│   ├── KalmanFilter.ts     # Bayesian state estimation
│   └── storage.ts          # IndexedDB wrapper
├── types/
│   └── photo.ts            # Photo type definitions
├── App.tsx                 # Root: mode switch, tick loop, zoom overlay
└── main.tsx                # Entry point
```

---

## 🎮 Gesture Interaction Map

| Gesture | Action |
|---|---|
| ☝️ Point at photo | **Open photo** (instant) |
| ✊ Fist (while photo open) | **Close photo** |
| 👆 Swipe left/right (on photo) | **Prev/Next photo** |
| 🖐️ Open palm | Photos → **Sphere** |
| ✊ Fist (in gallery) | Photos → **Rings** |
| 🖐️ + horizontal fan | **Rotate** the galaxy |
| 🤏 Pinch thumb-index | **Zoom** in/out |
| 🖱️ Mouse wheel | **Zoom** (2D mode) |
| ⌨️ Space | Toggle 2D/3D |
| ⌨️ Esc | Close photo |

---

## 🧠 Technical Deep-Dive

### Why One Euro Filter?
Traditional EMA smoothing has a fixed latency/smoothness tradeoff. The One Euro Filter adapts its cutoff frequency based on movement speed — smooth during slow, precise pointing, and responsive during fast swipes. Combined with adaptive gain mapping, the cursor feels "invisible" (1:1 with finger).

### Gesture Stability
Pinch detection uses a 5-frame majority voting window to eliminate frame-to-frame noise. Finger extension uses distance-from-wrist comparison instead of Y-axis, working in any hand orientation.

---

## 📦 Tech Stack

- **React 19** + TypeScript 5
- **Vite 8** (Oxc + Rolldown)
- **React Three Fiber** 9 + Three.js
- **MediaPipe Hands** (HandLandmarker, GPU delegate)
- **Zustand** 5 (state)
- **Tailwind CSS** 4
- **IndexedDB** (persistence)

---

## 📄 License

MIT