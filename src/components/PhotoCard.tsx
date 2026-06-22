import { memo, useRef, useState, useCallback } from "react";
import type { Photo } from "../types/photo";
import { usePhotoStore } from "../store/usePhotoStore";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "react-spring";

interface PhotoCardProps {
  photo: Photo;
  onClick: (photo: Photo) => void;
}

const SWIPE_THRESHOLD = 80;

const PhotoCard = memo(function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const deletePhoto = usePhotoStore((s) => s.deletePhoto);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  /* 3D 悬浮倾斜 */
  const [tiltSpring, tiltApi] = useSpring(() => ({
    rotX: 0,
    rotY: 0,
    config: { tension: 400, friction: 35 },
  }));

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    tiltApi.start({ rotX: -y * 8, rotY: x * 8 });
  };

  const handleMouseLeave = () => {
    tiltApi.start({ rotX: 0, rotY: 0 });
  };

  /* 滑动删除手势 */
  const [swipeSpring, swipeApi] = useSpring(() => ({
    x: 0,
    config: { tension: 400, friction: 35 },
  }));

  const bindSwipe = useDrag(
    ({ movement: [mx], active, direction: [dx] }) => {
      if (Math.abs(dx) < 0.8 && active) return;

      const clamped = Math.min(0, Math.max(-120, mx));
      swipeApi.start({ x: active ? clamped : 0, immediate: active });

      if (!active && mx < -SWIPE_THRESHOLD) {
        swipeApi.start({
          x: -400,
          config: { tension: 300, friction: 30 },
          onRest: () => {
            deletePhoto(photo.id);
          },
        });
      }
    },
    {
      axis: "x",
      filterTaps: true,
      pointer: { touch: true },
      preventDefault: true,
    }
  );

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isLongPress.current = false;
      timerRef.current = setTimeout(() => {
        isLongPress.current = true;
        setMenuPos({ x: e.clientX, y: e.clientY });
        setMenuOpen(true);
        if (navigator.vibrate) navigator.vibrate(10);
      }, 500);
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    clearTimer();
    if (!isLongPress.current && !menuOpen) {
      onClick(photo);
    }
  }, [onClick, photo, menuOpen]);

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const a = document.createElement("a");
      a.href = photo.url;
      a.download = `${photo.title}.jpg`;
      a.click();
      setMenuOpen(false);
    },
    [photo]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deletePhoto(photo.id);
      setMenuOpen(false);
    },
    [deletePhoto, photo.id]
  );

  return (
    <>
      <div className="relative overflow-hidden rounded-[16px] select-none touch-none">
        {/* 滑动删除背景 */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/60 to-red-400/40 rounded-[16px] flex items-center justify-end pr-5">
          <span className="text-white/90 text-sm font-medium">删除</span>
        </div>

        <animated.div
          {...bindSwipe()}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative cosmic-card cursor-pointer select-none overflow-hidden"
          style={{
            x: swipeSpring.x,
            rotateX: tiltSpring.rotX,
            rotateY: tiltSpring.rotY,
            touchAction: "none",
            transformStyle: "preserve-3d",
            perspective: "600px",
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={clearTimer}
          onPointerLeave={clearTimer}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 顶角辉光 */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[rgba(184,160,255,0.12)] to-transparent pointer-events-none rounded-bl-full" />

          <img
            src={photo.url}
            alt={photo.title}
            loading="lazy"
            className="w-full object-cover aspect-[3/4] pointer-events-none"
            draggable={false}
          />

          {/* 底栏 */}
          <div className="px-2.5 pt-2 pb-2.5 bg-gradient-to-t from-[rgba(10,10,30,0.6)] to-transparent">
            <p className="text-xs text-[#b0a0d0] text-center truncate">
              {photo.title}
            </p>
          </div>
        </animated.div>
      </div>

      {/* 长按菜单 */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="fixed z-50 bg-[rgba(25,25,55,0.95)] backdrop-blur-xl rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-[rgba(120,100,200,0.2)] py-1 min-w-[120px]"
            style={{ left: menuPos.x - 60, top: menuPos.y - 80 }}
          >
            <button
              onClick={handleSave}
              className="w-full text-left px-4 py-2 text-sm text-[#d0d0f0] hover:bg-[rgba(140,120,255,0.15)] transition-colors cursor-pointer"
            >
              保存图片
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[rgba(255,100,100,0.1)] transition-colors cursor-pointer"
            >
              删除
            </button>
          </div>
        </>
      )}
    </>
  );
});

export default PhotoCard;
