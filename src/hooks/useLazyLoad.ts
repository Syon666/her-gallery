import { useEffect, useRef, useState } from "react";

export function useLazyLoad(initialSize: number = 12, pageSize: number = 8) {
  const [visibleCount, setVisibleCount] = useState(initialSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + pageSize);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pageSize]);

  return { visibleCount, sentinelRef };
}
