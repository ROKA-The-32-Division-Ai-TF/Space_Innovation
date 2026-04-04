export type OpeningDirection = "inward-left" | "inward-right" | "outward-left" | "outward-right";

export type ObjectKind =
  | "bed"
  | "locker"
  | "desk"
  | "chair"
  | "storage"
  | "equipment"
  | "door"
  | "window"
  | "pillar"
  | "zone";

export type ElementCategory = "opening" | "structure" | "furniture" | "zone";

export interface Point {
  x: number;
  y: number;
}

export interface ArcSegment {
  kind: "arc";
  start: Point;
  end: Point;
  control: Point;
}

export interface LineSegment {
  kind: "line";
  start: Point;
  end: Point;
}

export type RoomBoundarySegment = LineSegment | ArcSegment;

export type RoomDrawTool = "line" | "arc";
export type RoomShapePreset = "rectangle" | "l-shape" | "u-shape";

export interface Size {
  width: number;
  height: number;
}

export interface BaseElement {
  id: string;
  name: string;
  kind: ObjectKind;
  category: ElementCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  opacity?: number;
  locked?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface DoorElement extends BaseElement {
  kind: "door";
  category: "opening";
  metadata: {
    openingDirection: OpeningDirection;
    swingDepth: number;
    isEmergencyExit?: boolean;
  };
}

export interface WindowElement extends BaseElement {
  kind: "window";
  category: "opening";
}

export interface RoomStructureElement extends BaseElement {
  kind: "pillar";
  category: "structure";
}

export interface SpaceObjectElement extends BaseElement {
  kind: "bed" | "locker" | "desk" | "chair" | "storage" | "equipment";
  category: "furniture";
}

export interface ZoneElement extends BaseElement {
  kind: "zone";
  category: "zone";
}

export type LayoutElement =
  | DoorElement
  | WindowElement
  | RoomStructureElement
  | SpaceObjectElement
  | ZoneElement;

export interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  outline: Point[];
  boundarySegments: RoomBoundarySegment[];
  wallHeight: number;
}

export type EditorMode = "select" | "draw-element" | "draw-room";

export interface SpaceLayout {
  id: string;
  name: string;
  description: string;
  room: Room;
  elements: LayoutElement[];
  ruleSetId: string;
}

export type RuleType =
  | "collision_constraint"
  | "door_clearance"
  | "corridor_band_min_width"
  | "min_distance_between_kinds"
  | "restricted_zone";

export interface BaseRule {
  rule_id: string;
  name: string;
  type: RuleType;
  target: string;
  message: string;
  severity: "critical" | "major" | "minor";
}

export interface CollisionRule extends BaseRule {
  type: "collision_constraint";
  targetKinds: ObjectKind[];
}

export interface DoorClearanceRule extends BaseRule {
  type: "door_clearance";
  target: "door_front";
  distance: number;
  applyToKinds: ObjectKind[];
}

export interface CorridorBandRule extends BaseRule {
  type: "corridor_band_min_width";
  target: "horizontal_band" | "vertical_band";
  bandStart: number;
  bandThickness: number;
  value: number;
}

export interface MinDistanceRule extends BaseRule {
  type: "min_distance_between_kinds";
  target: string;
  sourceKinds: ObjectKind[];
  otherKinds: ObjectKind[];
  value: number;
}

export interface RestrictedZoneRule extends BaseRule {
  type: "restricted_zone";
  target: "door_zone";
  distance: number;
  restrictedKinds: ObjectKind[];
}

export type RuleDefinition =
  | CollisionRule
  | DoorClearanceRule
  | CorridorBandRule
  | MinDistanceRule
  | RestrictedZoneRule;

export interface RuleSet {
  id: string;
  name: string;
  description: string;
  rules: RuleDefinition[];
}

export interface NormalizedRect {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  kind: ObjectKind;
  category: ElementCategory;
}

export interface RuleViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: BaseRule["severity"];
  message: string;
  elementIds: string[];
  details: string;
  metric?: number;
}

export interface ReviewSummary {
  compliantScore: number;
  totalRules: number;
  passedRules: number;
  violations: RuleViolation[];
}

export interface SuggestionResult {
  title: string;
  description: string;
  impactedElementIds: string[];
}

export type AutoLayoutProfile = "regulation-first" | "movement-first" | "capacity-first";
