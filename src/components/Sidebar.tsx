import { usePhotoStore } from "../store/usePhotoStore";

const ALL_STYLES = ["日系", "复古", "胶片", "黑白", "生活", "旅行"];

export default function Sidebar() {
  const photos = usePhotoStore((s) => s.photos);
  const selectedStyles = usePhotoStore((s) => s.selectedStyles);
  const toggleStyle = usePhotoStore((s) => s.toggleStyle);

  const styleCounts = ALL_STYLES.map((style) => ({
    style,
    count: photos.filter((p) => p.style.includes(style)).length,
  }));

  return (
    <div className="flex items-center gap-4">
      {styleCounts.map(({ style, count }) => {
        const active = selectedStyles.includes(style);
        return (
          <button
            key={style}
            onClick={() => toggleStyle(style)}
            className={`text-sm transition-all cursor-pointer flex items-center gap-1 px-2 py-1 rounded-full ${
              active
                ? "font-semibold text-[#b8a0ff] bg-[rgba(184,160,255,0.12)] shadow-[0_0_12px_rgba(184,160,255,0.15)]"
                : "text-[#7060a0] hover:text-[#b8a0ff]"
            }`}
          >
            {style}
            <span className={`text-xs ${active ? "text-[#b8a0ff]" : "text-[#504080]"}`}>
              {count}
            </span>
          </button>
        );
      })}
      {selectedStyles.length > 0 && (
        <button
          onClick={() => selectedStyles.forEach(toggleStyle)}
          className="text-xs text-[#605090] hover:text-[#b8a0ff] transition-colors cursor-pointer"
        >
          清除
        </button>
      )}
    </div>
  );
}
