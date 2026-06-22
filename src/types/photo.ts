export interface Photo {
  id: string;
  url: string;
  title: string;
  style: string[];
  date: string;
  width: number;
  height: number;
  favorited: boolean;
  location?: string;
}

export interface PhotoGroup {
  dateLabel: string;
  photos: Photo[];
}
