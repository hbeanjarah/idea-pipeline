export interface Label {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface User {
  id: string;
  email: string;
}

export interface Variation {
  id: string;
  text: string;
  createdAt: string; // ISO 8601
}

export interface Idea {
  id: string;
  labelId: string | null;
  title: string | null;
  variations: Variation[]; // always >= 1 (the initial capture)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601, refreshed on every mutation
}
