// Mirrors the schemas in docs/openapi.yaml.

export const STATUSES = [
  'captured',
  'maturing',
  'ready',
  'published',
] as const;

export type Status = (typeof STATUSES)[number];

export interface Variation {
  id: string;
  text: string;
  createdAt: string;
}

export interface Idea {
  id: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  variations: Variation[];
}
