import { create } from "zustand";
import type { Photo } from "../types/photo";
import { loadFromDB, saveToDB, clearDB } from "../utils/storage";

async function loadPhotos(): Promise<Photo[]> {
  const data = await loadFromDB<Photo[]>();
  if (!data || !Array.isArray(data)) return [];
  return data
    .map((p) => ({ ...p, favorited: p.favorited ?? false }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async function persistPhotos(photos: Photo[]): Promise<boolean> {
  return saveToDB(photos);
}

interface PhotoStore {
  photos: Photo[];
  selectedStyles: string[];
  dateFrom: string | null;
  dateTo: string | null;
  selectedPhoto: Photo | null;
  isModalOpen: boolean;
  modalIndex: number;
  uploadProgress: number;
  loading: boolean;

  init: () => Promise<void>;
  toggleStyle: (style: string) => void;
  setDateFilter: (from: string | null, to: string | null) => void;
  openModal: (photo: Photo) => void;
  closeModal: () => void;
  goNext: () => void;
  goPrev: () => void;
  addPhoto: (photo: Photo) => void;
  addPhotos: (photos: Photo[]) => void;
  deletePhoto: (id: string) => void;
  clearAllPhotos: () => void;
  toggleFavorite: (id: string) => void;
  setUploadProgress: (p: number) => void;
  getFilteredPhotos: () => Photo[];
}

export const usePhotoStore = create<PhotoStore>()((set, get) => ({
  photos: [],
  selectedStyles: [],
  dateFrom: null,
  dateTo: null,
  selectedPhoto: null,
  isModalOpen: false,
  modalIndex: 0,
  uploadProgress: 0,
  loading: true,

  init: async () => {
    try {
      const photos = await loadPhotos();
      set({ photos, loading: false });
    } catch (err) {
      console.error("[Store] init failed:", err);
      set({ photos: [], loading: false });
    }
  },

  toggleStyle: (style) =>
    set((state) => ({
      selectedStyles: state.selectedStyles.includes(style)
        ? state.selectedStyles.filter((s) => s !== style)
        : [...state.selectedStyles, style],
    })),

  setDateFilter: (from, to) => set({ dateFrom: from, dateTo: to }),

  openModal: (photo) => {
    const filtered = get().getFilteredPhotos();
    const idx = filtered.findIndex((p) => p.id === photo.id);
    set({ selectedPhoto: photo, isModalOpen: true, modalIndex: idx >= 0 ? idx : 0 });
  },

  closeModal: () => set({ isModalOpen: false, selectedPhoto: null }),

  goNext: () => {
    const { modalIndex, getFilteredPhotos } = get();
    const filtered = getFilteredPhotos();
    if (modalIndex < filtered.length - 1) {
      const next = modalIndex + 1;
      set({ modalIndex: next, selectedPhoto: filtered[next] });
    }
  },

  goPrev: () => {
    const { modalIndex, getFilteredPhotos } = get();
    const filtered = getFilteredPhotos();
    if (modalIndex > 0) {
      const prev = modalIndex - 1;
      set({ modalIndex: prev, selectedPhoto: filtered[prev] });
    }
  },

  addPhoto: (photo) =>
    set((state) => {
      const merged = [{ ...photo, favorited: false }, ...state.photos].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      persistPhotos(merged);
      return { photos: merged, uploadProgress: 0 };
    }),

  addPhotos: (newPhotos) =>
    set((state) => {
      const merged = [
        ...newPhotos.map((p) => ({ ...p, favorited: false })),
        ...state.photos,
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      persistPhotos(merged);
      return { photos: merged, uploadProgress: 0 };
    }),

  deletePhoto: (id) =>
    set((state) => {
      const next = state.photos.filter((p) => p.id !== id);
      persistPhotos(next);
      return { photos: next, isModalOpen: false, selectedPhoto: null };
    }),

  toggleFavorite: (id) =>
    set((state) => {
      const next = state.photos.map((p) =>
        p.id === id ? { ...p, favorited: !p.favorited } : p
      );
      persistPhotos(next);
      return { photos: next };
    }),

  clearAllPhotos: () =>
    set(() => {
      clearDB().then(() => loadPhotos());
      return { photos: [], isModalOpen: false, selectedPhoto: null };
    }),

  setUploadProgress: (p) => set({ uploadProgress: p }),

  getFilteredPhotos: () => {
    const { photos, selectedStyles, dateFrom, dateTo } = get();
    let result = photos;

    if (selectedStyles.length > 0) {
      result = result.filter((p) => selectedStyles.some((s) => p.style.includes(s)));
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime();
      result = result.filter((p) => new Date(p.date).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo).getTime() + 86400000;
      result = result.filter((p) => new Date(p.date).getTime() < toTs);
    }
    return result;
  },
}));
