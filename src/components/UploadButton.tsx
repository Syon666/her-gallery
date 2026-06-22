import { useState, useRef } from "react";
import { usePhotoStore } from "../store/usePhotoStore";
import { useDrag } from "@use-gesture/react";
import { useSpring, animated } from "react-spring";
import type { Photo } from "../types/photo";

const ALL_STYLES = ["日系", "复古", "胶片", "黑白", "生活", "旅行"];
const MAX_DIM = 800;
const JPEG_QUALITY = 0.7;

type Stage = "idle" | "reading" | "editing";

interface ImageItem {
  base64: string;
  fileName: string;
  editedStyle: string[];
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = MAX_DIM / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function UploadButton() {
  const addPhotos = usePhotoStore((s) => s.addPhotos);
  const [stage, setStage] = useState<Stage>("idle");
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [modalSpring, modalApi] = useSpring(() => ({ x: 0, y: 0, config: { tension: 500, friction: 35 } }));
  const bindModalDrag = useDrag(
    ({ offset: [x, y] }) => modalApi.start({ x, y, immediate: true }),
    { pointer: { touch: true }, filterTaps: true, from: () => [modalSpring.x.get(), modalSpring.y.get()] }
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const validFiles = files.filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (validFiles.length === 0) return;

    const total = validFiles.length;
    setStage("reading");
    setProgressDone(0);
    setProgressTotal(total);

    const base64s: string[] = new Array(total).fill("");
    let done = 0;
    await Promise.all(validFiles.map((f, i) => compressImage(f).then((b64) => { base64s[i] = b64; done++; setProgressDone(done); })));

    setItems(validFiles.map((f, i) => ({ base64: base64s[i], fileName: f.name, editedStyle: ["生活"] })));
    setDate(new Date().toISOString().slice(0, 10));
    setTitle("");
    setStage("editing");
  };

  const handleStyleToggle = (idx: number, style: string) => {
    setItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, editedStyle: item.editedStyle.includes(style) ? item.editedStyle.filter((s) => s !== style) : [...item.editedStyle, style] } : item
    ));
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    let loaded = 0;
    const total = items.length;
    const photos: Photo[] = new Array(total);
    items.forEach((item, i) => {
      const img = new Image();
      img.onload = () => {
        photos[i] = {
          id: `${Date.now()}-${i}`,
          url: item.base64,
          title: title || item.fileName || "未命名",
          style: item.editedStyle.length > 0 ? item.editedStyle : ["生活"],
          date: new Date(date).toISOString(),
          width: img.naturalWidth, height: img.naturalHeight,
          favorited: false,
        };
        loaded++;
        if (loaded === total) { addPhotos(photos); reset(); }
      };
      img.onerror = () => {
        photos[i] = {
          id: `${Date.now()}-${i}`,
          url: item.base64,
          title: title || item.fileName || "未命名",
          style: item.editedStyle.length > 0 ? item.editedStyle : ["生活"],
          date: new Date(date).toISOString(),
          width: 0, height: 0,
          favorited: false,
        };
        loaded++;
        if (loaded === total) { addPhotos(photos.filter(Boolean)); reset(); }
      };
      img.src = item.base64;
    });
  };

  const reset = () => {
    setStage("idle"); setItems([]); setProgressDone(0); setProgressTotal(0);
    setDate(new Date().toISOString().slice(0, 10)); setTitle("");
    modalApi.start({ x: 0, y: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFile} className="hidden" />
      <button onClick={() => fileRef.current?.click()} disabled={stage === "reading"}
        className="text-sm border rounded-full px-4 py-1.5 transition-all cursor-pointer disabled:opacity-50 text-[#b8a0ff] border-[rgba(184,160,255,0.3)] hover:text-[#d0c0ff] hover:border-[rgba(184,160,255,0.6)] hover:shadow-[0_0_16px_rgba(184,160,255,0.15)]">
        {stage === "reading" ? `处理 ${progressDone}/${progressTotal}` : "✦ 上传"}
      </button>

      {stage === "editing" && items.length > 0 && (
        <div className="fixed inset-0 z-50 bg-[rgba(4,3,16,0.55)] backdrop-blur-md flex items-center justify-center" onClick={reset}>
          <animated.div {...bindModalDrag()}
            className="bg-[rgba(14,10,38,0.95)] backdrop-blur-2xl rounded-2xl p-6 w-[520px] max-h-[85vh] overflow-y-auto shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(140,120,220,0.08)] border border-[rgba(140,120,220,0.12)] cursor-grab active:cursor-grabbing touch-none"
            style={{ x: modalSpring.x, y: modalSpring.y }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center pb-3 mb-3 border-b border-[rgba(120,100,200,0.1)]">
              <div className="w-8 h-1 rounded-full bg-[rgba(120,100,200,0.3)]" />
            </div>
            <h3 className="text-[#e0e0f0] text-base font-medium mb-4">✦ 添加 {items.length} 张照片</h3>
            <div className="space-y-4 mb-5 max-h-[50vh] overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start border border-[rgba(120,100,200,0.15)] rounded-xl p-3 bg-[rgba(30,30,65,0.4)]">
                  <img src={item.base64} alt={item.fileName} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#9080b0] truncate mb-1.5">{item.fileName}</p>
                    <div className="flex flex-wrap gap-1">
                      {ALL_STYLES.map((s) => (
                        <button key={s} onClick={() => handleStyleToggle(idx, s)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${item.editedStyle.includes(s) ? "bg-[#b8a0ff] text-[#0a0a20] border-[#b8a0ff]" : "text-[#7060a0] border-[rgba(120,100,200,0.2)] hover:border-[#b8a0ff]"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <label className="block text-xs text-[#9080b0] mb-1">统一标题</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="统一标题（可选）"
              className="w-full text-sm px-3 py-2 rounded-lg border border-[rgba(120,100,200,0.2)] mb-4 focus:outline-none focus:border-[#b8a0ff] bg-[rgba(15,15,35,0.6)] text-[#e0e0f0] placeholder:text-[#504080]" />
            <label className="block text-xs text-[#9080b0] mb-1">统一日期</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-[rgba(120,100,200,0.2)] mb-5 focus:outline-none focus:border-[#b8a0ff] bg-[rgba(15,15,35,0.6)] text-[#e0e0f0] [color-scheme:dark]" />
            <div className="flex gap-3 justify-end">
              <button onClick={reset} className="text-sm text-[#7060a0] hover:text-[#b8a0ff] cursor-pointer">取消</button>
              <button onClick={handleSubmit} className="text-sm text-[#0a0a20] bg-[#b8a0ff] rounded-full px-5 py-1.5 hover:bg-[#c8b0ff] cursor-pointer shadow-[0_0_16px_rgba(184,160,255,0.3)]">确认添加 ({items.length})</button>
            </div>
          </animated.div>
        </div>
      )}
    </>
  );
}
