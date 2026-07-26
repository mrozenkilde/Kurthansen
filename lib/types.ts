export type UserRole = "admin" | "maler";
export type CaseStatus = "aktiv" | "afsluttet";
export type WallStatus = "ikke_paabegyndt" | "i_gang" | "klar_til_ks" | "godkendt";
export type PhotoType = "dokumentation" | "kvalitetssikring";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at?: string;
}

export interface Case {
  id: string;
  case_number: string;
  customer_name: string;
  address: string;
  status: CaseStatus;
  created_by: string | null;
  created_at: string;
}

export interface FloorPlan {
  id: string;
  case_id: string;
  name: string;
  image_path: string;
  original_path: string | null;
  width: number;
  height: number;
  created_at: string;
}

/** Punkt normaliseret 0..1 relativt til plantegningens bredde/højde */
export type Point = [number, number];

export interface Room {
  id: string;
  floor_plan_id: string;
  name: string;
  polygon: Point[];
  created_at?: string;
}

export interface Wall {
  id: string;
  floor_plan_id: string;
  room_id: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color_name: string | null;
  color_hex: string | null;
  status: WallStatus;
  created_at?: string;
}

export interface Pin {
  id: string;
  floor_plan_id: string;
  x: number;
  y: number;
  note: string;
  created_by: string | null;
  created_at: string;
  photo_count?: number;
}

export interface Photo {
  id: string;
  wall_id: string | null;
  pin_id?: string | null;
  type: PhotoType;
  storage_path: string;
  taken_by: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  room_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author_name?: string;
}

export const WALL_STATUS_LABELS: Record<WallStatus, string> = {
  ikke_paabegyndt: "Ikke påbegyndt",
  i_gang: "I gang",
  klar_til_ks: "Klar til KS",
  godkendt: "Godkendt",
};

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  dokumentation: "Dokumentation",
  kvalitetssikring: "Kvalitetssikring",
};
