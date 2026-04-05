import { PointerEvent, ReactNode, useMemo, useRef, useState } from "react";
import { EditorMode, LayoutElement, ObjectKind, Point, RoomBoundarySegment, RoomDrawTool, SpaceLayout } from "../types/layout";
import { AnalyzeResponse, AnalyzeSeverity } from "../types/analyze";
import { catalogItems } from "../data/catalog";
import { boundarySegmentsToPath, createArcSegment, createLineSegment, flattenBoundarySegments } from "../engine/geometry";

interface CanvasEditorProps {
  layout: SpaceLayout;
  selectedElementId?: string;
  editorMode: EditorMode;
  drawKind?: ObjectKind;
  helperText: string;
  roomDrawTool: RoomDrawTool;
  curveDirection: 1 | -1;
  analysisResult?: AnalyzeResponse | null;
  showAnalysisOverlay?: boolean;
  svgId?: string;
  onSelectElement: (elementId: string | undefined) => void;
  onUpdateElement: (elementId: string, patch: Partial<LayoutElement>) => void;
  onCreateElement: (kind: ObjectKind, rect: { x: number; y: number; width: number; height: number }) => void;
  onUpdateRoomGeometry: (outline: Point[], boundarySegments: RoomBoundarySegment[]) => void;
}

interface DragState {
  elementId: string;
  offsetX: number;
  offsetY: number;
}

interface VisualProps {
  element: LayoutElement;
  width: number;
  height: number;
  selected: boolean;
  severity?: AnalyzeSeverity;
}

interface DraftRectState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const GRID_SIZE = 20;
const CLOSE_THRESHOLD = 28;

const pointsToString = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(" ");

const distanceBetween = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const snapValue = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const snapPointToGrid = (point: Point): Point => ({
  x: snapValue(point.x),
  y: snapValue(point.y)
});

const getOrthogonalSnap = (origin: Point, point: Point): Point => {
  const snapped = snapPointToGrid(point);
  const dx = snapped.x - origin.x;
  const dy = snapped.y - origin.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: snapped.x,
      y: origin.y
    };
  }

  return {
    x: origin.x,
    y: snapped.y
  };
};

const quadraticBezierPoint = (start: Point, control: Point, end: Point, t: number): Point => {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y
  };
};

const getSegmentMidpoint = (segment: RoomBoundarySegment): Point => {
  if (segment.kind === "line") {
    return {
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2
    };
  }

  return quadraticBezierPoint(segment.start, segment.control, segment.end, 0.5);
};

const getSegmentLength = (segment: RoomBoundarySegment) => {
  if (segment.kind === "line") {
    return Math.round(Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y));
  }

  let length = 0;
  let previous = segment.start;

  for (let step = 1; step <= 16; step += 1) {
    const point = quadraticBezierPoint(segment.start, segment.control, segment.end, step / 16);
    length += distanceBetween(previous, point);
    previous = point;
  }

  return Math.round(length);
};

const createArcControlPoint = (start: Point, end: Point, direction: 1 | -1): Point => {
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const normalX = (-dy / length) * direction;
  const normalY = (dx / length) * direction;
  const offset = Math.max(40, Math.min(140, length * 0.3));

  return {
    x: midpoint.x + normalX * offset,
    y: midpoint.y + normalY * offset
  };
};

const segmentsToPath = (segments: RoomBoundarySegment[], closed: boolean) => {
  const path = boundarySegmentsToPath(segments);
  return closed ? path : path.replace(/\sZ$/, "");
};

const segmentToPreviewPath = (segment: RoomBoundarySegment) => segmentsToPath([segment], false);

const getSegmentLabelPoint = (segment: RoomBoundarySegment) => {
  const point = getSegmentMidpoint(segment);
  return {
    x: point.x,
    y: point.y
  };
};

const severityPriority: Record<AnalyzeSeverity, number> = {
  info: 1,
  low: 1,
  minor: 1,
  medium: 2,
  major: 2,
  warning: 2,
  high: 3,
  critical: 3,
  error: 3
};

const normalizeSeverity = (severity: AnalyzeSeverity) => {
  if (severity === "high" || severity === "critical" || severity === "error") {
    return "critical";
  }

  if (severity === "medium" || severity === "major" || severity === "warning") {
    return "major";
  }

  return "minor";
};

const severityText = (severity: AnalyzeSeverity) => {
  const normalized = normalizeSeverity(severity);
  return normalized === "critical" ? "심각" : normalized === "major" ? "주의" : "알림";
};

const getSeverityFill = (severity?: AnalyzeSeverity) => {
  const normalized = severity ? normalizeSeverity(severity) : "minor";

  if (normalized === "critical") {
    return "#fff4f1";
  }

  if (normalized === "major") {
    return "#fff9ef";
  }

  return "#f8fafc";
};

const getSeverityStroke = (severity?: AnalyzeSeverity, selected?: boolean) => {
  if (selected) {
    return "#0f766e";
  }

  const normalized = severity ? normalizeSeverity(severity) : "minor";

  if (normalized === "critical") {
    return "#b42318";
  }

  if (normalized === "major") {
    return "#b66a00";
  }

  return "#415364";
};

const severityClassForHalo = (severity: AnalyzeSeverity) => {
  const normalized = normalizeSeverity(severity);
  return normalized === "critical"
    ? "element-review-halo--critical"
    : normalized === "major"
      ? "element-review-halo--major"
      : "element-review-halo--minor";
};

const severityClassForZone = (severity: AnalyzeSeverity) => {
  const normalized = normalizeSeverity(severity);
  return normalized === "critical"
    ? "review-zone review-zone--critical"
    : normalized === "major"
      ? "review-zone review-zone--major"
      : "review-zone review-zone--minor";
};

const severityClassForChip = (severity: AnalyzeSeverity) => {
  const normalized = normalizeSeverity(severity);
  return normalized === "critical"
    ? "review-chip review-chip--critical"
    : normalized === "major"
      ? "review-chip review-chip--major"
      : "review-chip review-chip--minor";
};

const FurnitureVisual = ({ element, width, height, selected, severity }: VisualProps) => {
  const baseStroke = getSeverityStroke(severity, selected);
  const accentStroke = baseStroke;
  const panelFill = getSeverityFill(severity);
  const mutedFill = "rgba(230, 235, 239, 0.95)";
  const steelFill = "rgba(214, 222, 229, 0.98)";
  const textileFill = "rgba(229, 237, 244, 0.98)";
  const emphasisFill = panelFill;

  if (element.kind === "bed") {
    return (
      <>
        <rect x={0} y={0} width={width} height={height} rx={8} ry={8} fill={panelFill} stroke={accentStroke} strokeWidth={2.4} />
        <rect x={8} y={8} width={width - 16} height={height - 16} rx={6} ry={6} fill={textileFill} stroke="rgba(82, 97, 112, 0.2)" strokeWidth={1.4} />
        <rect x={12} y={12} width={Math.max(width * 0.26, 26)} height={Math.max(height * 0.24, 18)} rx={5} ry={5} fill="#ffffff" stroke="rgba(90, 108, 126, 0.18)" strokeWidth={1.2} />
        <line x1={width - 10} y1={10} x2={width - 10} y2={height - 10} stroke={accentStroke} strokeWidth={1.4} />
        <line x1={18} y1={height - 18} x2={width - 18} y2={height - 18} stroke="rgba(86, 103, 120, 0.26)" strokeWidth={2} strokeLinecap="round" />
      </>
    );
  }

  if (element.kind === "locker") {
    return (
      <>
        <rect x={0} y={0} width={width} height={height} rx={6} ry={6} fill={emphasisFill} stroke={accentStroke} strokeWidth={2.3} />
        <line x1={width / 2} y1={8} x2={width / 2} y2={height - 8} stroke={accentStroke} strokeWidth={1.4} />
        <circle cx={width / 2 - 8} cy={height / 2} r={2.2} fill={accentStroke} />
        <circle cx={width / 2 + 8} cy={height / 2} r={2.2} fill={accentStroke} />
        <line x1={12} y1={14} x2={width - 12} y2={14} stroke="rgba(65, 83, 100, 0.18)" strokeWidth={1.2} />
        <line x1={12} y1={20} x2={width - 12} y2={20} stroke="rgba(65, 83, 100, 0.18)" strokeWidth={1.2} />
      </>
    );
  }

  if (element.kind === "desk") {
    return (
      <>
        <rect x={6} y={8} width={width - 12} height={height - 18} rx={5} ry={5} fill={panelFill} stroke={accentStroke} strokeWidth={2.2} />
        <rect x={12} y={14} width={Math.max(width * 0.24, 22)} height={height - 30} rx={4} ry={4} fill={mutedFill} stroke="rgba(82, 97, 112, 0.18)" strokeWidth={1.1} />
        <line x1={18} y1={20} x2={18 + Math.max(width * 0.18, 14)} y2={20} stroke="rgba(82, 97, 112, 0.22)" strokeWidth={1.2} />
        <line x1={18} y1={26} x2={18 + Math.max(width * 0.18, 14)} y2={26} stroke="rgba(82, 97, 112, 0.22)" strokeWidth={1.2} />
        <line x1={16} y1={height - 10} x2={16} y2={height - 2} stroke={accentStroke} strokeWidth={2.2} />
        <line x1={width - 16} y1={height - 10} x2={width - 16} y2={height - 2} stroke={accentStroke} strokeWidth={2.2} />
      </>
    );
  }

  if (element.kind === "chair") {
    return (
      <>
        <rect x={10} y={18} width={width - 20} height={height * 0.26} rx={5} ry={5} fill={mutedFill} stroke={accentStroke} strokeWidth={2.1} />
        <rect x={12} y={6} width={width - 24} height={height * 0.2} rx={5} ry={5} fill={panelFill} stroke={accentStroke} strokeWidth={1.8} />
        <line x1={18} y1={height * 0.44} x2={14} y2={height - 6} stroke={accentStroke} strokeWidth={2.2} />
        <line x1={width - 18} y1={height * 0.44} x2={width - 14} y2={height - 6} stroke={accentStroke} strokeWidth={2.2} />
      </>
    );
  }

  if (element.kind === "storage") {
    return (
      <>
        <rect x={0} y={0} width={width} height={height} rx={6} ry={6} fill={emphasisFill} stroke={accentStroke} strokeWidth={2.3} />
        <line x1={10} y1={height / 2} x2={width - 10} y2={height / 2} stroke={accentStroke} strokeWidth={1.4} />
        <rect x={width * 0.34} y={8} width={width * 0.32} height={7} rx={3} ry={3} fill="#e7eef5" stroke="rgba(82, 97, 112, 0.16)" strokeWidth={1} />
      </>
    );
  }

  if (element.kind === "equipment") {
    return (
      <>
        <rect x={0} y={0} width={width} height={height} rx={6} ry={6} fill={steelFill} stroke={accentStroke} strokeWidth={2.3} />
        <rect x={10} y={10} width={width - 20} height={height - 20} rx={4} ry={4} fill="none" stroke="rgba(82, 97, 112, 0.18)" strokeWidth={1.3} />
        <circle cx={24} cy={height / 2} r={5} fill="#f2b91c" stroke={accentStroke} strokeWidth={1.2} />
        <rect x={width - 42} y={height / 2 - 6} width={22} height={12} rx={3} ry={3} fill="#f2b91c" stroke={accentStroke} strokeWidth={1.2} />
      </>
    );
  }

  if (element.kind === "board") {
    return (
      <>
        <rect x={0} y={0} width={width} height={height} rx={6} ry={6} fill="#f7fafc" stroke={accentStroke} strokeWidth={2.3} />
        <rect x={8} y={8} width={width - 16} height={height - 16} rx={4} ry={4} fill="#eef3f8" stroke="rgba(82, 97, 112, 0.18)" strokeWidth={1.2} />
        <line x1={18} y1={18} x2={width - 18} y2={18} stroke={accentStroke} strokeWidth={1.3} />
        <line x1={18} y1={30} x2={width - 28} y2={30} stroke="rgba(82, 97, 112, 0.2)" strokeWidth={1.2} />
        <line x1={18} y1={42} x2={width - 40} y2={42} stroke="rgba(82, 97, 112, 0.2)" strokeWidth={1.2} />
      </>
    );
  }

  if (element.kind === "door") {
    return (
      <>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={accentStroke} strokeWidth={3} />
        <line x1={10} y1={height - 3} x2={10} y2={3} stroke={accentStroke} strokeWidth={2.2} />
        <path
          d={`M 10 ${height - 3} Q ${width / 2} ${height - Math.min(width * 0.5, 46)} ${width - 8} ${height - 3}`}
          fill="none"
          stroke="rgba(82, 97, 112, 0.26)"
          strokeWidth={1.8}
          strokeDasharray="5 4"
        />
        <line x1={10} y1={height - 3} x2={width - 8} y2={height - 3} stroke={accentStroke} strokeWidth={1.8} />
      </>
    );
  }

  if (element.kind === "window") {
    return (
      <>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={accentStroke} strokeWidth={3} />
        <line x1={8} y1={5} x2={width - 8} y2={5} stroke="rgba(82, 97, 112, 0.18)" strokeWidth={1.8} />
        <line x1={8} y1={height - 5} x2={width - 8} y2={height - 5} stroke="rgba(82, 97, 112, 0.18)" strokeWidth={1.8} />
        <line x1={width / 2} y1={5} x2={width / 2} y2={height - 5} stroke="rgba(82, 97, 112, 0.18)" strokeWidth={1.4} />
      </>
    );
  }

  if (element.kind === "pillar") {
    return (
      <>
        <rect x={0} y={0} width={width} height={height} rx={4} ry={4} fill={steelFill} stroke={accentStroke} strokeWidth={2.2} />
        <line x1={6} y1={6} x2={width - 6} y2={height - 6} stroke="rgba(82, 97, 112, 0.24)" strokeWidth={1.4} />
        <line x1={width - 6} y1={6} x2={6} y2={height - 6} stroke="rgba(82, 97, 112, 0.24)" strokeWidth={1.4} />
      </>
    );
  }

  return <rect x={0} y={0} width={width} height={height} rx={8} ry={8} fill={panelFill} stroke={accentStroke} strokeWidth={2.2} />;
};

export const CanvasEditor = ({
  layout,
  selectedElementId,
  editorMode,
  drawKind,
  helperText,
  roomDrawTool,
  curveDirection,
  analysisResult,
  showAnalysisOverlay = false,
  svgId = "layout-export-surface",
  onSelectElement,
  onUpdateElement,
  onCreateElement,
  onUpdateRoomGeometry
}: CanvasEditorProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRectState | null>(null);
  const [roomDraftPoints, setRoomDraftPoints] = useState<Point[]>([]);
  const [roomDraftSegments, setRoomDraftSegments] = useState<RoomBoundarySegment[]>([]);
  const [roomPreviewSegment, setRoomPreviewSegment] = useState<RoomBoundarySegment | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panState, setPanState] = useState<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const violationElementSeverity = useMemo(() => {
    const severityMap = new Map<string, AnalyzeSeverity>();

    if (!showAnalysisOverlay || !analysisResult) {
      return severityMap;
    }

    analysisResult.issues.forEach((issue) => {
      issue.relatedElementIds?.forEach((elementId) => {
        const current = severityMap.get(elementId);
        if (!current || severityPriority[issue.severity] > severityPriority[current]) {
          severityMap.set(elementId, issue.severity);
        }
      });
    });

    return severityMap;
  }, [analysisResult, showAnalysisOverlay]);

  const toCanvasPoint = (event: PointerEvent<SVGRectElement | SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * layout.room.width,
      y: ((event.clientY - bounds.top) / bounds.height) * layout.room.height
    };
  };

  const handlePointerDown = (event: PointerEvent<SVGRectElement>, element: LayoutElement) => {
    event.stopPropagation();

    if (editorMode !== "select") {
      onSelectElement(element.id);
      return;
    }

    if (element.locked) {
      onSelectElement(element.id);
      return;
    }

    const point = toCanvasPoint(event);
    setDragState({
      elementId: element.id,
      offsetX: point.x - element.x,
      offsetY: point.y - element.y
    });
    onSelectElement(element.id);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (panState && viewportRef.current) {
      viewportRef.current.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
      viewportRef.current.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
      return;
    }

    if (dragState) {
      const point = toCanvasPoint(event);
      onUpdateElement(dragState.elementId, {
        x: point.x - dragState.offsetX,
        y: point.y - dragState.offsetY
      });
      return;
    }

    if (draftRect) {
      const point = toCanvasPoint(event);
      setDraftRect((current) =>
        current
          ? {
              ...current,
              currentX: point.x,
              currentY: point.y
            }
          : current
      );
    }

    if (editorMode === "draw-room" && roomDraftPoints.length > 0) {
      const point = toCanvasPoint(event);
      const lastPoint = roomDraftPoints[roomDraftPoints.length - 1];
      const snappedEnd = roomDrawTool === "line" ? getOrthogonalSnap(lastPoint, point) : snapPointToGrid(point);
      setRoomPreviewSegment(
        roomDrawTool === "line"
          ? createLineSegment(lastPoint, snappedEnd)
          : createArcSegment(lastPoint, snappedEnd, createArcControlPoint(lastPoint, snappedEnd, curveDirection))
      );
    }
  };

  const stopDragging = () => {
    setDragState(null);
    setPanState(null);

    if (draftRect && drawKind && editorMode === "draw-element") {
      const x = Math.min(draftRect.startX, draftRect.currentX);
      const y = Math.min(draftRect.startY, draftRect.currentY);
      const width = Math.max(24, Math.abs(draftRect.currentX - draftRect.startX));
      const height = Math.max(24, Math.abs(draftRect.currentY - draftRect.startY));
      onCreateElement(drawKind, { x, y, width, height });
    }

    setDraftRect(null);
  };

  const finalizeRoomSegments = (segments: RoomBoundarySegment[]) => {
    const flattened = flattenBoundarySegments(segments, 18);
    const outline =
      flattened.length > 1 && distanceBetween(flattened[0], flattened[flattened.length - 1]) < 2
        ? flattened.slice(0, -1)
        : flattened;

    if (outline.length >= 3) {
      onUpdateRoomGeometry(outline, segments);
    }

    setRoomDraftPoints([]);
    setRoomDraftSegments([]);
    setRoomPreviewSegment(null);
  };

  const handleCanvasPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (zoomLevel > 1 && editorMode === "select") {
      const target = event.target as Element | null;
      const isElementHit = Boolean(target?.closest("[data-element-hitbox='true']"));

      if (!isElementHit && viewportRef.current) {
        setPanState({
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: viewportRef.current.scrollLeft,
          scrollTop: viewportRef.current.scrollTop
        });
        return;
      }
    }

    if (editorMode === "draw-room") {
      const point = snapPointToGrid(toCanvasPoint(event));

      if (roomDraftPoints.length === 0) {
        setRoomDraftPoints([point]);
        setRoomDraftSegments([]);
        setRoomPreviewSegment(null);
        onSelectElement(undefined);
        return;
      }

      const firstPoint = roomDraftPoints[0];
      const lastPoint = roomDraftPoints[roomDraftPoints.length - 1];
      const snappedPoint = roomDrawTool === "line" ? getOrthogonalSnap(lastPoint, point) : snapPointToGrid(point);

      if (roomDraftPoints.length >= 3 && distanceBetween(point, firstPoint) < CLOSE_THRESHOLD) {
        finalizeRoomSegments([...roomDraftSegments, createLineSegment(lastPoint, firstPoint)]);
        onSelectElement(undefined);
        return;
      }

      if (distanceBetween(snappedPoint, lastPoint) < 4) {
        return;
      }

      const nextSegment =
        roomDrawTool === "line"
          ? createLineSegment(lastPoint, snappedPoint)
          : createArcSegment(lastPoint, snappedPoint, createArcControlPoint(lastPoint, snappedPoint, curveDirection));

      setRoomDraftPoints((current) => [...current, snappedPoint]);
      setRoomDraftSegments((current) => [...current, nextSegment]);
      setRoomPreviewSegment(null);
      onSelectElement(undefined);
      return;
    }

    if (editorMode !== "draw-element" || !drawKind) {
      onSelectElement(undefined);
      return;
    }

    const point = toCanvasPoint(event);
    setDraftRect({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
    onSelectElement(undefined);
  };

  const draftDimensions = draftRect
    ? {
        x: Math.min(draftRect.startX, draftRect.currentX),
        y: Math.min(draftRect.startY, draftRect.currentY),
        width: Math.max(24, Math.abs(draftRect.currentX - draftRect.startX)),
        height: Math.max(24, Math.abs(draftRect.currentY - draftRect.startY))
      }
    : null;

  const draftSegments = roomPreviewSegment ? [...roomDraftSegments, roomPreviewSegment] : roomDraftSegments;
  const activeOutline =
    editorMode === "draw-room" && draftSegments.length > 0 ? flattenBoundarySegments(draftSegments, 18) : layout.room.outline;
  const roomPath = segmentsToPath(layout.room.boundarySegments, true);
  const activeRoomPath = editorMode === "draw-room" && draftSegments.length > 0 ? segmentsToPath(draftSegments, false) : roomPath;

  const modeLabel =
    editorMode === "draw-room" ? "벽 그리기" : editorMode === "draw-element" ? `${catalogItems.find((item) => item.kind === drawKind)?.label ?? "요소"} 추가` : "선택";

  const renderSegmentTag = (segment: RoomBoundarySegment, key: string): ReactNode => {
    const labelPoint = getSegmentLabelPoint(segment);
    const length = getSegmentLength(segment);

    return (
      <g key={key} pointerEvents="none">
        <rect x={labelPoint.x - 34} y={labelPoint.y - 18} width={68} height={22} rx={8} ry={8} className="segment-tag" />
        <text x={labelPoint.x} y={labelPoint.y - 3} textAnchor="middle" className="segment-tag__text">
          {length} cm
        </text>
      </g>
    );
  };

  return (
    <section className="canvas-shell">
      <div className="canvas-shell__header">
        <div>
          <h2>{layout.name}</h2>
          <p>{helperText}</p>
        </div>
        <div className="canvas-shell__meta">
          <span className="legend">{modeLabel}</span>
          <span className="legend">
            {layout.room.width} x {layout.room.height}cm
          </span>
          <div className="canvas-zoom-controls">
            <button
              className="canvas-zoom-controls__button"
              disabled={zoomLevel <= 1}
              onClick={() => setZoomLevel((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
              type="button"
            >
              -
            </button>
            <button className="canvas-zoom-controls__button canvas-zoom-controls__button--value" onClick={() => setZoomLevel(1)} type="button">
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              className="canvas-zoom-controls__button"
              disabled={zoomLevel >= 2.5}
              onClick={() => setZoomLevel((current) => Math.min(2.5, Number((current + 0.25).toFixed(2))))}
              type="button"
            >
              +
            </button>
            <button className="canvas-zoom-controls__button" onClick={() => setZoomLevel(1)} type="button">
              맞춤
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={zoomLevel > 1 ? "canvas-viewport canvas-viewport--pan" : "canvas-viewport"}
        onPointerUp={() => setPanState(null)}
        onPointerLeave={() => setPanState(null)}
      >
        <div className="canvas-stage" style={{ width: `${zoomLevel * 100}%` }}>
        <svg
          id={svgId}
          ref={svgRef}
          className="floor-canvas"
          viewBox={`0 0 ${layout.room.width} ${layout.room.height}`}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerLeave={stopDragging}
          onDoubleClick={() => {
            if (editorMode === "draw-room" && roomDraftPoints.length >= 3 && roomDraftSegments.length >= 2) {
              finalizeRoomSegments([...roomDraftSegments, createLineSegment(roomDraftPoints[roomDraftPoints.length - 1], roomDraftPoints[0])]);
            }
          }}
        >
          <defs>
            <clipPath id="room-clip">{roomPath ? <path d={roomPath} /> : null}</clipPath>
          </defs>

          {roomPath ? <path d={roomPath} className="room-boundary-path" /> : null}

          {showAnalysisOverlay && roomPath ? (
            <g clipPath="url(#room-clip)">
              {analysisResult?.issues.map((issue) => {
                if (!issue.region) {
                  return null;
                }

                if (issue.region.type === "rect") {
                  return (
                    <rect
                      key={issue.id}
                      x={issue.region.x}
                      y={issue.region.y}
                      width={issue.region.width}
                      height={issue.region.height}
                      className={severityClassForZone(issue.severity)}
                      rx={6}
                      ry={6}
                    />
                  );
                }

                return (
                  <polygon
                    key={issue.id}
                    points={pointsToString(issue.region.points)}
                    className={severityClassForZone(issue.severity)}
                  />
                );
              })}
            </g>
          ) : null}

          {activeOutline.length >= 2 ? (
            <path d={activeRoomPath} className={editorMode === "draw-room" ? "room-outline-draft" : "room-outline"} fill="none" />
          ) : null}

          {editorMode === "draw-room" && roomDraftSegments.length > 0 ? roomDraftSegments.map((segment, index) => renderSegmentTag(segment, `${segment.kind}-${index}`)) : null}
          {editorMode === "draw-room" && roomPreviewSegment ? (
            <>
              <path d={segmentToPreviewPath(roomPreviewSegment)} className="room-preview-segment" />
              {renderSegmentTag(roomPreviewSegment, "preview")}
            </>
          ) : null}

          {editorMode === "draw-room" && roomDraftPoints.length > 0 ? (
            <>
              {roomDraftPoints.map((point, index) => (
                <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={6} className="room-vertex" />
              ))}
              <text x={roomDraftPoints[0].x + 12} y={roomDraftPoints[0].y - 12} className="draft-label">
                벽 작성 중
              </text>
              {roomDraftPoints.length >= 3 ? <circle cx={roomDraftPoints[0].x} cy={roomDraftPoints[0].y} r={12} className="room-vertex room-vertex--close" /> : null}
            </>
          ) : null}

          {layout.elements.map((element) => {
            const selected = selectedElementId === element.id;
            const width = element.rotation === 90 || element.rotation === 270 ? element.height : element.width;
            const height = element.rotation === 90 || element.rotation === 270 ? element.width : element.height;
            const severity = violationElementSeverity.get(element.id);

            return (
              <g key={element.id} transform={`translate(${element.x}, ${element.y})`} style={{ opacity: element.opacity ?? 1 }}>
                {showAnalysisOverlay && severity ? (
                  <rect
                    x={-4}
                    y={-4}
                    width={width + 8}
                    height={height + 8}
                    className={`element-review-halo ${severityClassForHalo(severity)}`}
                    rx={10}
                    ry={10}
                  />
                ) : null}
                <FurnitureVisual element={element} width={width} height={height} selected={selected} severity={severity} />
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  fill="transparent"
                  data-element-hitbox="true"
                  className={selected ? "shape shape--selected" : "shape"}
                  onPointerDown={(event) => handlePointerDown(event, element)}
                />
                <text x={12} y={20} className="shape-label">
                  {element.name}
                </text>
              </g>
            );
          })}

          {draftDimensions ? (
            <g pointerEvents="none">
              <rect x={draftDimensions.x} y={draftDimensions.y} width={draftDimensions.width} height={draftDimensions.height} className="draft-rect" />
              <text x={draftDimensions.x + 10} y={draftDimensions.y + 20} className="draft-label">
                {Math.round(draftDimensions.width)} x {Math.round(draftDimensions.height)}cm
              </text>
            </g>
          ) : null}

          {showAnalysisOverlay && analysisResult?.issues.length ? (
            <g pointerEvents="none">
              {analysisResult.issues.slice(0, 3).map((issue, index) => (
                <text key={`issue-label-${issue.id}`} x={24} y={28 + index * 22} className="analysis-legend-text">
                  <tspan className={severityClassForChip(issue.severity)}>{severityText(issue.severity)}</tspan>
                  <tspan dx={8}>{issue.title || issue.message}</tspan>
                </text>
              ))}
            </g>
          ) : null}
        </svg>
        </div>
      </div>

      {layout.elements.length === 0 && editorMode === "select" ? (
        <div className="canvas-shell__empty">
          <strong>아직 배치된 요소가 없습니다.</strong>
          <p>하단의 추가 버튼으로 문, 창문, 가구를 배치해보세요.</p>
        </div>
      ) : null}
    </section>
  );
};
