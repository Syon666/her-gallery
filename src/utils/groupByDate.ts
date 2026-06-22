import type { Photo, PhotoGroup } from "../types/photo";

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return "本周";
  if (diffDays < 30) return "本月";
  return "更早";
}

const LABEL_ORDER = ["今天", "昨天", "本周", "本月", "更早"];

export function groupByDate(photos: Photo[]): PhotoGroup[] {
  const groups = new Map<string, Photo[]>();

  for (const photo of photos) {
    const label = getDateLabel(photo.date);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(photo);
  }

  return LABEL_ORDER
    .filter((label) => groups.has(label))
    .map((label) => ({
      dateLabel: label,
      photos: groups.get(label)!,
    }));
}
