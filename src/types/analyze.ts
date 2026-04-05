import { ElementCategory, ObjectKind, Point, RoomBoundarySegment } from "./layout";

export type AnalyzeSeverity = "info" | "low" | "medium" | "high" | "minor" | "major" | "critical" | "warning" | "error";

export interface AnalyzeRegionRect {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnalyzeRegionPolygon {
  type: "polygon";
  points: Point[];
}

export type AnalyzeRegion = AnalyzeRegionRect | AnalyzeRegionPolygon;

export interface AnalyzeRequestRoom {
  width: number;
  height: number;
  outline: Point[];
  boundary_segments: RoomBoundarySegment[];
}

export interface AnalyzeRequestElement {
  id: string;
  name: string;
  type: ObjectKind;
  category: ElementCategory;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  metadata?: Record<string, string | number | boolean>;
}

export interface AnalyzeRequest {
  space_type: string;
  layout_id: string;
  unit: "cm";
  room: AnalyzeRequestRoom;
  objects: AnalyzeRequestElement[];
}

export interface AnalyzeSubscores {
  pathway?: number;
  access?: number;
  density?: number;
  alignment?: number;
}

export interface AnalyzeIssue {
  id: string;
  title: string;
  severity: AnalyzeSeverity;
  message: string;
  region?: AnalyzeRegion;
  relatedElementIds?: string[];
}

export interface AnalyzeResponse {
  score: number;
  subscores?: AnalyzeSubscores;
  summary: string;
  suggestions: string[];
  issues: AnalyzeIssue[];
}

export interface HealthResponse {
  ok: boolean;
  version?: string;
}
