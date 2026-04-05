import { ElementCategory, ObjectKind, Point, RoomBoundarySegment } from "./layout";

export type AnalyzeSeverity = "low" | "medium" | "high" | "minor" | "major" | "critical";

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
  boundarySegments: RoomBoundarySegment[];
}

export interface AnalyzeRequestElement {
  id: string;
  name: string;
  kind: ObjectKind;
  category: ElementCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  metadata?: Record<string, string | number | boolean>;
}

export interface AnalyzeRequest {
  spaceType: string;
  layoutId: string;
  unit: "cm";
  room: AnalyzeRequestRoom;
  elements: AnalyzeRequestElement[];
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
  summary: string;
  suggestions: string[];
  issues: AnalyzeIssue[];
}

export interface HealthResponse {
  ok: boolean;
  version?: string;
}
