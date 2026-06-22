import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  baseOpacity: number;
  speed: number;
  phase: number;
  hue: number;
  depth: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((width * height) / 3000);
      starsRef.current = [];
      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        starsRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 2 + 0.2,
          baseOpacity: Math.random() * 0.6 + 0.3,
          speed: Math.random() * 0.015 + 0.003,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.12 ? 200 + Math.random() * 40 : 0,
          depth,
        });
      }
    };

    /* 生成流星 */
    const spawnShootingStar = () => {
      shootingRef.current.push({
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * height * 0.3,
        vx: -(3 + Math.random() * 5),
        vy: 3 + Math.random() * 4,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        length: 60 + Math.random() * 100,
      });
    };

    /* 鼠标视差追踪 */
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / width,
        y: e.clientY / height,
      };
    };

    window.addEventListener("mousemove", onMouseMove);

    const draw = (time: number) => {
      const { x: mx, y: my } = mouseRef.current;
      const parallaxX = (mx - 0.5) * 15;
      const parallaxY = (my - 0.5) * 15;

      ctx.clearRect(0, 0, width, height);

      /* 绘制星星 */
      for (const star of starsRef.current) {
        const twinkle = Math.sin(time * star.speed + star.phase) * 0.35 + 0.65;
        const alpha = star.baseOpacity * twinkle;

        // 视差：深层星星移动少
        const px = star.x + parallaxX * star.depth;
        const py = star.y + parallaxY * star.depth;

        ctx.beginPath();
        ctx.arc(px, py, star.r, 0, Math.PI * 2);

        if (star.hue > 0) {
          ctx.fillStyle = `hsla(${star.hue}, 50%, 75%, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        }
        ctx.fill();

        if (star.r > 1.1) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, star.r * 3);
          const ga = alpha * 0.18;
          if (star.hue > 0) {
            glow.addColorStop(0, `hsla(${star.hue}, 50%, 75%, ${ga})`);
          } else {
            glow.addColorStop(0, `rgba(255, 255, 255, ${ga})`);
          }
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.fill();
        }
      }

      /* 绘制流星 */
      for (let i = shootingRef.current.length - 1; i >= 0; i--) {
        const s = shootingRef.current[i];
        s.life++;
        if (s.life > s.maxLife) {
          shootingRef.current.splice(i, 1);
          continue;
        }

        const progress = s.life / s.maxLife;
        const alpha = progress < 0.15
          ? progress / 0.15
          : 1 - (progress - 0.15) / 0.85;

        const cx = s.x + s.vx * s.life;
        const cy = s.y + s.vy * s.life;

        const grad = ctx.createLinearGradient(
          cx, cy,
          cx - s.vx * s.length * 0.02,
          cy - s.vy * s.length * 0.02
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx - s.vx * s.length * 0.02,
          cy - s.vy * s.length * 0.02
        );
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* 随机生成流星 */
      if (Math.random() < 0.003 && shootingRef.current.length < 3) {
        spawnShootingStar();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
