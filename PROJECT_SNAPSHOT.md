# 她的相册 — 项目快照

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React 19 + TypeScript 6 |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 3D 引擎 | Three.js 0.184 + @react-three/fiber 9 |
| 动画 | @react-spring/three + framer-motion |
| 手势识别 | @tensorflow-models/handpose + TFJS WebGL |
| 存储 | IndexedDB |
| 图标 | lucide-react |

## 文件架构

```
src/
├── App.tsx                    # 主入口: 模式切换/手势集成/双手分流
├── main.tsx                   # ReactDOM 挂载
├── index.css                  # 全局样式 + Tailwind
│
├── components/
│   ├── Galaxy3D.tsx           # ★ 3D 银河: 球体↔环形/涟漪/粒子/光晕
│   ├── CosmicRing.tsx         # 2D 环形银河: 拖拽/Ctrl旋转/滚轮缩放
│   ├── Starfield.tsx          # 星空背景粒子层
│   ├── PhotoCard.tsx          # 2D 照片卡片
│   ├── PhotoGrid.tsx          # 照片网格 (旧版)
│   ├── PhotoModal.tsx         # 大图弹窗: 滑动/捏合/双击
│   ├── UploadButton.tsx       # 上传: 批量/Canvas压缩/IndexedDB
│   ├── DateFilter.tsx         # 日期筛选
│   └── Sidebar.tsx            # 侧边栏 (旧版)
│
├── hooks/
│   ├── useHandGesture.ts      # ★ 手势核心: handpose/双手/捏合
│   └── useLazyLoad.ts         # Intersection Observer
│
├── store/
│   └── usePhotoStore.ts       # Zustand: CRUD/filter/favorite
│
├── types/
│   └── photo.ts               # Photo + PhotoGroup 类型
│
└── utils/
    ├── storage.ts             # IndexedDB 封装
    └── groupByDate.ts         # 日期分组
```

## 核心数据流

```
摄像头 → handpose.estimateHands()
             │
    useHandGesture (EMA平滑/左右识别/捏合)
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
 旋转速度  缩放级别  手部3D投影
 (左手)   (右手)   (涟漪)
    │        │        │
    ▼        ▼        ▼
         Galaxy3D
    ┌───────┼───────┐
    ▼       ▼       ▼
RotatingGroup  ZoomController  PhotoCardRipple
```

## 手势交互矩阵

```
        左手 (left)              右手 (right)
旋转    五指张开+扇动 → 惯性      —
缩放    —                        拇指食指捏合 → zoom
形态    握拳↔张开 → 球体↔环形     —
涟漪    —                        手指靠近照片 → 预发光
```

## 3D 场景层级

```
Canvas
├─ Stars (800 粒子)
├─ Controls (鼠标备用)
├─ ZoomController (捏合→camera.z)
├─ ParticleBurst (120 粒子)
├─ PalmAura (武装态光晕环)
└─ RotatingGroup
   └─ PhotoCardRipple × N
      ├─ 照片纹理 (meshPhysicalMaterial)
      ├─ 辉光边框
      ├─ 涟漪光晕
      └─ hover 发光环
```

## 关键参数速查

| 参数 | 值 | 位置 |
|------|----|------|
| 惯性衰减 τ | 1.8s | App.tsx |
| 旋转冲量系数 | 4.0 | App.tsx |
| 旋转限速 | ±3 rad/s | App.tsx |
| 缩放范围 | 0.4x–3.5x | App.tsx |
| 涟漪检测半径 | 1.8 | Galaxy3D |
| 掌心武装延迟 | 4帧 | App.tsx |
| EMA 平滑 α | 0.3(位置) 0.4(速度) | useHandGesture |
| 照片卡尺寸 | 1.0×1.33 | Galaxy3D |
| 球体/环形半径 | 3.5 / 5.5 | Galaxy3D |
| 上传压缩 | 800px, JPEG 0.7 | UploadButton |

## 启动

```bash
cd D:\Syon-project\photo-gallery
npx vite
# → http://localhost:5173
```

## 可清理

- `public/mediapipe/` + `@mediapipe/*` 三个包（已废弃）
- `Sidebar.tsx` `PhotoGrid.tsx` 旧版组件