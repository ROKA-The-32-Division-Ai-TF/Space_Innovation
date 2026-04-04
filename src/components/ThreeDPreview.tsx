import { PointerEvent, useMemo, useState } from "react";
import { catalogItems } from "../data/catalog";
import { flattenBoundarySegments, getElementDimensions, getPathBounds, getPolygonCentroid, getRoomWallSections } from "../engine/geometry";
import { LayoutElement, Point, SpaceLayout } from "../types/layout";

export type ShellOpacityMode = "opacity-1" | "opacity-2" | "solid";

interface ThreeDPreviewProps {
  layout: SpaceLayout;
  selectedElement?: LayoutElement;
  selectedElementId?: string;
  shellOpacityMode: ShellOpacityMode;
  onChangeShellOpacityMode: (mode: ShellOpacityMode) => void;
  onUpdateRoomWallHeight: (value: number) => void;
  onUpdateElementHeight: (elementId: string, value: number) => void;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

interface Face {
  key: string;
  points: ProjectedPoint[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  depth: number;
  opacity?: number;
  dashed?: boolean;
}

interface Decoration {
  key: string;
  type: "polygon" | "line" | "circle";
  points?: ProjectedPoint[];
  point?: ProjectedPoint;
  point2?: ProjectedPoint;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

const VIEW_WIDTH = 920;
const VIEW_HEIGHT = 560;

const shellOpacityMap: Record<ShellOpacityMode, number> = {
  "opacity-1": 0.16,
  "opacity-2": 0.34,
  solid: 0.68
};

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const tintHex = (hex: string, amount: number) => {
  const cleaned = hex.replace("#", "");
  const num = Number.parseInt(cleaned, 16);
  const r = clampChannel((num >> 16) + amount);
  const g = clampChannel(((num >> 8) & 255) + amount);
  const b = clampChannel((num & 255) + amount);
  return `rgb(${r}, ${g}, ${b})`;
};

const pointsToString = (points: ProjectedPoint[]) => points.map((point) => `${point.x},${point.y}`).join(" ");

const averageDepth = (points: ProjectedPoint[]) => points.reduce((sum, point) => sum + point.depth, 0) / points.length;

const interpolatePoint = (a: ProjectedPoint, b: ProjectedPoint, t: number): ProjectedPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  depth: a.depth + (b.depth - a.depth) * t
});

const facePoint = (quad: ProjectedPoint[], u: number, v: number) => {
  const top = interpolatePoint(quad[0], quad[1], u);
  const bottom = interpolatePoint(quad[3], quad[2], u);
  return interpolatePoint(top, bottom, v);
};

const normalizeRoomPolygon = (layout: SpaceLayout): Point[] => {
  const points =
    layout.room.boundarySegments.length > 0 ? flattenBoundarySegments(layout.room.boundarySegments, 18) : layout.room.outline;

  if (points.length <= 1) {
    return layout.room.outline;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) < 2 ? points.slice(0, -1) : points;
};

const createProjector = (roomPolygon: Point[], wallHeight: number, yawDeg: number, pitchDeg: number) => {
  const center = getPolygonCentroid(roomPolygon);
  const bounds = getPathBounds(roomPolygon);
  const extent = Math.max(bounds.width, bounds.height) + wallHeight * 1.15;
  const baseScale = Math.min(1.08, 820 / Math.max(extent, 1));
  const originX = VIEW_WIDTH / 2;
  const originY = VIEW_HEIGHT * 0.69;
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cameraDistance = extent * 1.7;

  return (point: Point3D): ProjectedPoint => {
    const localX = point.x - center.x;
    const localY = point.y - center.y;
    const localZ = point.z;

    const yawX = localX * Math.cos(yaw) - localY * Math.sin(yaw);
    const yawDepth = localX * Math.sin(yaw) + localY * Math.cos(yaw);

    const vertical = localZ * Math.cos(pitch) - yawDepth * Math.sin(pitch);
    const depth = yawDepth * Math.cos(pitch) + localZ * Math.sin(pitch);
    const perspective = cameraDistance / (cameraDistance + depth + extent * 0.3);

    return {
      x: originX + yawX * baseScale * perspective,
      y: originY - vertical * baseScale * perspective,
      depth
    };
  };
};

const getVolumeHeight = (element: LayoutElement) => {
  const metadata = element.metadata as Record<string, string | number | boolean> | undefined;
  const metadataHeight = metadata?.["volumeHeight"];
  if (typeof metadataHeight === "number") {
    return metadataHeight;
  }

  const catalog = catalogItems.find((item) => item.kind === element.kind);
  return catalog?.volumeHeight ?? 90;
};

const createElementVolume = (element: LayoutElement) => {
  const dimensions = getElementDimensions(element);
  const z = getVolumeHeight(element);

  return {
    base: [
      { x: element.x, y: element.y, z: 0 },
      { x: element.x + dimensions.width, y: element.y, z: 0 },
      { x: element.x + dimensions.width, y: element.y + dimensions.height, z: 0 },
      { x: element.x, y: element.y + dimensions.height, z: 0 }
    ] as Point3D[],
    top: [
      { x: element.x, y: element.y, z },
      { x: element.x + dimensions.width, y: element.y, z },
      { x: element.x + dimensions.width, y: element.y + dimensions.height, z },
      { x: element.x, y: element.y + dimensions.height, z }
    ] as Point3D[]
  };
};

const createDecorationSet = (element: LayoutElement, topFace: ProjectedPoint[], color: string): Decoration[] => {
  const inner = [
    facePoint(topFace, 0.08, 0.12),
    facePoint(topFace, 0.92, 0.12),
    facePoint(topFace, 0.92, 0.88),
    facePoint(topFace, 0.08, 0.88)
  ];

  if (element.kind === "bed") {
    return [
      {
        key: `${element.id}-mattress`,
        type: "polygon",
        points: inner,
        fill: "rgba(255,255,255,0.58)",
        stroke: "rgba(90, 120, 165, 0.22)",
        strokeWidth: 1
      },
      {
        key: `${element.id}-pillow`,
        type: "polygon",
        points: [
          facePoint(topFace, 0.08, 0.12),
          facePoint(topFace, 0.34, 0.12),
          facePoint(topFace, 0.34, 0.34),
          facePoint(topFace, 0.08, 0.34)
        ],
        fill: "rgba(187, 203, 230, 0.95)"
      }
    ];
  }

  if (element.kind === "locker") {
    return [
      {
        key: `${element.id}-split`,
        type: "line",
        point: facePoint(topFace, 0.5, 0.1),
        point2: facePoint(topFace, 0.5, 0.9),
        stroke: "rgba(65, 84, 110, 0.42)",
        strokeWidth: 1.2
      },
      {
        key: `${element.id}-knob-1`,
        type: "circle",
        point: facePoint(topFace, 0.42, 0.5),
        radius: 2.4,
        fill: "rgba(67, 85, 108, 0.9)"
      },
      {
        key: `${element.id}-knob-2`,
        type: "circle",
        point: facePoint(topFace, 0.58, 0.5),
        radius: 2.4,
        fill: "rgba(67, 85, 108, 0.9)"
      }
    ];
  }

  if (element.kind === "desk") {
    return [
      {
        key: `${element.id}-desk-top`,
        type: "polygon",
        points: inner,
        fill: "rgba(255,255,255,0.26)",
        stroke: "rgba(72, 95, 86, 0.24)",
        strokeWidth: 1
      },
      {
        key: `${element.id}-desk-line`,
        type: "line",
        point: facePoint(topFace, 0.16, 0.22),
        point2: facePoint(topFace, 0.84, 0.22),
        stroke: "rgba(255,255,255,0.52)",
        strokeWidth: 1.2
      }
    ];
  }

  if (element.kind === "chair") {
    return [
      {
        key: `${element.id}-seat`,
        type: "polygon",
        points: [
          facePoint(topFace, 0.18, 0.22),
          facePoint(topFace, 0.82, 0.22),
          facePoint(topFace, 0.82, 0.74),
          facePoint(topFace, 0.18, 0.74)
        ],
        fill: "rgba(255,255,255,0.22)",
        stroke: "rgba(80, 98, 90, 0.28)",
        strokeWidth: 1
      }
    ];
  }

  if (element.kind === "storage" || element.kind === "equipment") {
    return [
      {
        key: `${element.id}-lid`,
        type: "polygon",
        points: inner,
        fill: "rgba(255,255,255,0.22)",
        stroke: "rgba(68, 96, 79, 0.24)",
        strokeWidth: 1
      },
      {
        key: `${element.id}-handle`,
        type: "line",
        point: facePoint(topFace, 0.36, 0.16),
        point2: facePoint(topFace, 0.64, 0.16),
        stroke: tintHex(color, -62),
        strokeWidth: 2
      }
    ];
  }

  if (element.kind === "window") {
    return [
      {
        key: `${element.id}-window-cross-v`,
        type: "line",
        point: facePoint(topFace, 0.5, 0.12),
        point2: facePoint(topFace, 0.5, 0.88),
        stroke: "rgba(88, 146, 164, 0.72)",
        strokeWidth: 1.2
      },
      {
        key: `${element.id}-window-cross-h`,
        type: "line",
        point: facePoint(topFace, 0.1, 0.5),
        point2: facePoint(topFace, 0.9, 0.5),
        stroke: "rgba(88, 146, 164, 0.72)",
        strokeWidth: 1.2
      }
    ];
  }

  return [
    {
      key: `${element.id}-top`,
      type: "polygon",
      points: inner,
      fill: "rgba(255,255,255,0.18)",
      stroke: "rgba(0,0,0,0.08)",
      strokeWidth: 1
    }
  ];
};

const createElementFaces = (element: LayoutElement, projector: ReturnType<typeof createProjector>, selected: boolean) => {
  const volume = createElementVolume(element);
  const base = volume.base.map(projector);
  const top = volume.top.map(projector);
  const catalog = catalogItems.find((item) => item.kind === element.kind);
  const color = catalog?.color ?? "#a3b1c6";
  const stroke = selected ? "#17352d" : "rgba(31, 45, 36, 0.2)";
  const faceOpacity = element.opacity ?? 1;

  const faces: Face[] = [
    {
      key: `${element.id}-front`,
      points: [base[3], base[2], top[2], top[3]],
      fill: tintHex(color, -24),
      stroke,
      strokeWidth: selected ? 2.2 : 1,
      depth: averageDepth([base[3], base[2], top[2], top[3]]),
      opacity: faceOpacity
    },
    {
      key: `${element.id}-right`,
      points: [base[1], base[2], top[2], top[1]],
      fill: tintHex(color, -10),
      stroke,
      strokeWidth: selected ? 2.2 : 1,
      depth: averageDepth([base[1], base[2], top[2], top[1]]),
      opacity: faceOpacity
    },
    {
      key: `${element.id}-left`,
      points: [base[0], base[3], top[3], top[0]],
      fill: tintHex(color, -30),
      stroke,
      strokeWidth: selected ? 2.2 : 1,
      depth: averageDepth([base[0], base[3], top[3], top[0]]),
      opacity: faceOpacity
    },
    {
      key: `${element.id}-top-face`,
      points: top,
      fill: tintHex(color, 38),
      stroke,
      strokeWidth: selected ? 2.2 : 1,
      depth: averageDepth(top) + 0.1,
      opacity: faceOpacity
    }
  ];

  const decorations = createDecorationSet(element, top, color).map((decoration) => ({
    ...decoration,
    opacity: faceOpacity
  }));

  return { faces, decorations };
};

export const ThreeDPreview = ({
  layout,
  selectedElement,
  selectedElementId,
  shellOpacityMode,
  onChangeShellOpacityMode,
  onUpdateRoomWallHeight,
  onUpdateElementHeight
}: ThreeDPreviewProps) => {
  const [yaw, setYaw] = useState(34);
  const [pitch, setPitch] = useState(44);
  const [dragState, setDragState] = useState<{ x: number; y: number } | null>(null);
  const roomPolygon = useMemo(() => normalizeRoomPolygon(layout), [layout]);
  const wallSections = useMemo(() => getRoomWallSections(layout.room.boundarySegments, 18), [layout.room.boundarySegments]);
  const shellOpacity = shellOpacityMap[shellOpacityMode];
  const projector = useMemo(() => createProjector(roomPolygon, layout.room.wallHeight, yaw, pitch), [layout.room.wallHeight, pitch, roomPolygon, yaw]);

  const roomFaces = useMemo(() => {
    const bounds = getPathBounds(roomPolygon);
    const floor = roomPolygon.map((point) => projector({ x: point.x, y: point.y, z: 0 }));
    const floorShadow = floor.map((point) => ({
      ...point,
      x: point.x + 18,
      y: point.y + 24
    }));

    const groundPadX = Math.max(bounds.width * 0.28, 180);
    const groundPadY = Math.max(bounds.height * 0.28, 180);
    const groundPlane = [
      projector({ x: bounds.minX - groundPadX, y: bounds.minY - groundPadY, z: 0 }),
      projector({ x: bounds.maxX + groundPadX, y: bounds.minY - groundPadY, z: 0 }),
      projector({ x: bounds.maxX + groundPadX, y: bounds.maxY + groundPadY, z: 0 }),
      projector({ x: bounds.minX - groundPadX, y: bounds.maxY + groundPadY, z: 0 })
    ];

    const walls = wallSections.map((section, index) => {
      const quad = [
        projector({ x: section.start.x, y: section.start.y, z: 0 }),
        projector({ x: section.end.x, y: section.end.y, z: 0 }),
        projector({ x: section.end.x, y: section.end.y, z: layout.room.wallHeight }),
        projector({ x: section.start.x, y: section.start.y, z: layout.room.wallHeight })
      ];

      const midFactor = Math.min(38, index % 2 === 0 ? 18 : 26);
      return {
        key: section.key,
        points: quad,
        fill: tintHex("#d2dbd1", midFactor),
        stroke: "rgba(48, 56, 50, 0.16)",
        strokeWidth: section.sourceKind === "arc" ? 1.1 : 1.3,
        depth: averageDepth(quad),
        opacity: shellOpacity
      } satisfies Face;
    });

    const topOutline = wallSections.map((section) => projector({ x: section.start.x, y: section.start.y, z: layout.room.wallHeight }));

    return {
      groundPlane,
      floor,
      floorShadow,
      walls: walls.sort((a, b) => a.depth - b.depth),
      topOutline
    };
  }, [layout.room.wallHeight, projector, roomPolygon, shellOpacity, wallSections]);

  const furniture = useMemo(() => {
    const allFaces: Face[] = [];
    const decorations: Decoration[] = [];

    layout.elements.forEach((element) => {
      const result = createElementFaces(element, projector, element.id === selectedElementId);
      allFaces.push(...result.faces);
      decorations.push(...result.decorations);
    });

    return {
      faces: allFaces.sort((a, b) => a.depth - b.depth),
      decorations: decorations.sort((a, b) => {
        const depthA = a.points ? averageDepth(a.points) : a.point?.depth ?? 0;
        const depthB = b.points ? averageDepth(b.points) : b.point?.depth ?? 0;
        return depthA - depthB;
      })
    };
  }, [layout.elements, projector, selectedElementId]);

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    setDragState({ x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragState) {
      return;
    }

    const deltaX = event.clientX - dragState.x;
    const deltaY = event.clientY - dragState.y;
    setYaw((current) => (current + deltaX * 0.45 + 360) % 360);
    setPitch((current) => Math.max(18, Math.min(64, current - deltaY * 0.18)));
    setDragState({ x: event.clientX, y: event.clientY });
  };

  const stopDragging = () => setDragState(null);

  return (
    <section className="panel-card preview-card">
      <div className="panel-heading">
        <h3>3D 배치 보기</h3>
        <div className="opacity-switch">
          <button
            className={shellOpacityMode === "opacity-1" ? "opacity-switch__button active" : "opacity-switch__button"}
            onClick={() => onChangeShellOpacityMode("opacity-1")}
            type="button"
          >
            투명도 1
          </button>
          <button
            className={shellOpacityMode === "opacity-2" ? "opacity-switch__button active" : "opacity-switch__button"}
            onClick={() => onChangeShellOpacityMode("opacity-2")}
            type="button"
          >
            투명도 2
          </button>
          <button
            className={shellOpacityMode === "solid" ? "opacity-switch__button active" : "opacity-switch__button"}
            onClick={() => onChangeShellOpacityMode("solid")}
            type="button"
          >
            불투명
          </button>
        </div>
      </div>

      <p className="summary-text">벽면을 실제 세그먼트 단위로 계산해서 바닥과 벽이 따로 보이도록 다시 구성했습니다. 드래그로 회전하고 벽 높이와 가구 높이를 조절할 수 있습니다.</p>

      <div className="preview-meta">
        <span>벽면 수 {wallSections.length}개</span>
        <span>벽 높이 {layout.room.wallHeight}cm</span>
        <span>{selectedElement ? `${selectedElement.name} 높이 ${getVolumeHeight(selectedElement)}cm` : "가구를 선택하면 3D 높이를 조절할 수 있습니다."}</span>
      </div>

      <div className="camera-controls camera-controls--three">
        <label>
          회전각 {Math.round(yaw)}°
          <input type="range" min={0} max={360} value={yaw} onChange={(event) => setYaw(Number(event.target.value))} />
        </label>
        <label>
          시점 높이 {Math.round(pitch)}°
          <input type="range" min={18} max={64} value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
        </label>
        <label>
          벽 높이 {layout.room.wallHeight}cm
          <input
            type="range"
            min={180}
            max={420}
            step={10}
            value={layout.room.wallHeight}
            onChange={(event) => onUpdateRoomWallHeight(Number(event.target.value))}
          />
        </label>
      </div>

      {selectedElement ? (
        <div className="camera-controls">
          <label>
            선택 가구 3D 높이 {getVolumeHeight(selectedElement)}cm
            <input
              type="range"
              min={20}
              max={260}
              step={5}
              value={getVolumeHeight(selectedElement)}
              onChange={(event) => onUpdateElementHeight(selectedElement.id, Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="preview-3d"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
      >
        <defs>
          <linearGradient id="floorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fcfcf8" />
            <stop offset="100%" stopColor="#d8ddd2" />
          </linearGradient>
          <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f4f5ef" />
            <stop offset="100%" stopColor="#d4dbcf" />
          </linearGradient>
        </defs>

        <polygon points={pointsToString(roomFaces.groundPlane)} fill="url(#groundGradient)" />
        <polygon points={pointsToString(roomFaces.floorShadow)} fill="rgba(55, 61, 55, 0.07)" />
        <polygon points={pointsToString(roomFaces.floor)} fill="url(#floorGradient)" stroke="rgba(45, 58, 46, 0.18)" strokeWidth={1.8} />

        {roomFaces.walls.map((face) => (
          <polygon
            key={face.key}
            points={pointsToString(face.points)}
            fill={face.fill}
            stroke={face.stroke}
            strokeWidth={face.strokeWidth}
            opacity={shellOpacityMode === "solid" ? 0.96 : face.opacity}
          />
        ))}

        {roomFaces.topOutline.length > 1 ? (
          <polyline
            points={pointsToString(roomFaces.topOutline)}
            fill="none"
            stroke="rgba(51, 61, 55, 0.32)"
            strokeWidth={1.6}
          />
        ) : null}

        {furniture.faces.map((face) => (
          <polygon
            key={face.key}
            points={pointsToString(face.points)}
            fill={face.fill}
            stroke={face.stroke}
            strokeWidth={face.strokeWidth}
            opacity={face.opacity}
            strokeDasharray={face.dashed ? "6 4" : undefined}
          />
        ))}

        {furniture.decorations.map((item) => {
          if (item.type === "polygon" && item.points) {
            return (
              <polygon
                key={item.key}
                points={pointsToString(item.points)}
                fill={item.fill}
                stroke={item.stroke}
                strokeWidth={item.strokeWidth}
                opacity={item.opacity}
              />
            );
          }

          if (item.type === "line" && item.point && item.point2) {
            return (
              <line
                key={item.key}
                x1={item.point.x}
                y1={item.point.y}
                x2={item.point2.x}
                y2={item.point2.y}
                stroke={item.stroke}
                strokeWidth={item.strokeWidth}
                opacity={item.opacity}
              />
            );
          }

          if (item.type === "circle" && item.point) {
            return <circle key={item.key} cx={item.point.x} cy={item.point.y} r={item.radius} fill={item.fill} opacity={item.opacity} />;
          }

          return null;
        })}
      </svg>
    </section>
  );
};
