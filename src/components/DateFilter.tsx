import { usePhotoStore } from "../store/usePhotoStore";

export default function DateFilter() {
  const dateFrom = usePhotoStore((s) => s.dateFrom);
  const dateTo = usePhotoStore((s) => s.dateTo);
  const setDateFilter = usePhotoStore((s) => s.setDateFilter);

  const hasFilter = dateFrom !== null || dateTo !== null;

  const handleClear = () => setDateFilter(null, null);

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={dateFrom ?? ""}
        onChange={(e) => setDateFilter(e.target.value || null, dateTo)}
        className="text-xs px-2 py-1 rounded-lg border border-[rgba(120,100,200,0.15)] bg-[rgba(15,15,35,0.5)] text-[#b0a0d0] focus:outline-none focus:border-[#b8a0ff] [color-scheme:dark] w-[120px]"
        placeholder="开始日期"
      />
      <span className="text-[#504080] text-xs">—</span>
      <input
        type="date"
        value={dateTo ?? ""}
        onChange={(e) => setDateFilter(dateFrom, e.target.value || null)}
        className="text-xs px-2 py-1 rounded-lg border border-[rgba(120,100,200,0.15)] bg-[rgba(15,15,35,0.5)] text-[#b0a0d0] focus:outline-none focus:border-[#b8a0ff] [color-scheme:dark] w-[120px]"
        placeholder="结束日期"
      />
      {hasFilter && (
        <button
          onClick={handleClear}
          className="text-xs text-[#605090] hover:text-[#b8a0ff] transition-colors cursor-pointer"
        >
          清除
        </button>
      )}
    </div>
  );
}
