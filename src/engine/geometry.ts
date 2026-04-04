import {
  ArcSegment,
  LayoutElement,
  LineSegment,
  NormalizedRect,
  Point,
  Room,
  RoomBoundarySegment,
  RoomShapePreset
} from "../types/layout";

export interface RoomWallSection {
  key: string;
  start: Point;
  end: Point;
  length: number;
  sourceKind: RoomBoundarySegment["kind"];
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

export const getElementDimensions = (element: LayoutElement) => {
  // 2D MVP에서는 90도 단위 회전만 허용하므로 폭/높이만 서로 교환하면 된다.
  const rotation = normalizeRotation(element.rotation);
  if (rotation === 90 || rotation === 270) {
    return {
      width: element.height,
      height: element.width
    };
  }

  return {
    width: element.width,
    height: element.height
  };
};

export const normalizeElementRect = (element: LayoutElement): NormalizedRect => {
  // 룰 엔진은 모든 객체를 동일한 축 정렬 사각형으로 변환한 뒤 계산한다.
  const dimensions = getElementDimensions(element);
  return {
    id: element.id,
    name: element.name,
    x: element.x,
    y: element.y,
    width: dimensions.width,
    height: dimensions.height,
    centerX: element.x + dimensions.width / 2,
    centerY: element.y + dimensions.height / 2,
    kind: element.kind,
    category: element.category
  };
};

export const clampElementToRoom = (element: LayoutElement, room: Room): LayoutElement => {
  // 사용자가 드래그하거나 수치를 직접 입력해도 방 바깥으로 벗어나지 않게 보정한다.
  const dimensions = getElementDimensions(element);
  const nextElement = {
    ...element,
    x: Math.max(0, Math.min(element.x, room.width - dimensions.width)),
    y: Math.max(0, Math.min(element.y, room.height - dimensions.height))
  };

  if (pointInPolygon({ x: nextElement.x + dimensions.width / 2, y: nextElement.y + dimensions.height / 2 }, room.outline)) {
    return nextElement;
  }

  // 비정형 외곽선의 경우 완전한 충돌 보정보다 중심점이 공간 내부에 위치하는 안전 위치로 이동시킨다.
  const center = getPolygonCentroid(room.outline);
  return {
    ...nextElement,
    x: Math.max(0, Math.min(center.x - dimensions.width / 2, room.width - dimensions.width)),
    y: Math.max(0, Math.min(center.y - dimensions.height / 2, room.height - dimensions.height))
  };
};

export const rectsOverlap = (a: NormalizedRect, b: NormalizedRect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export const getIntersectionWidth = (a: NormalizedRect, b: NormalizedRect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));

export const getIntersectionHeight = (a: NormalizedRect, b: NormalizedRect) =>
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

export const getEdgeDistance = (a: NormalizedRect, b: NormalizedRect) => {
  // 직사각형 간 최소 가장자리 거리를 계산한다. 겹치면 0이 반환된다.
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);

  if (dx === 0) {
    return dy;
  }

  if (dy === 0) {
    return dx;
  }

  return Math.sqrt(dx ** 2 + dy ** 2);
};

export const detectDoorWall = (rect: NormalizedRect, room: Room) => {
  // 문이 방 어느 벽면에 붙어 있는지 추정하여 전방 여유공간 방향을 계산한다.
  const epsilon = 30;

  if (rect.y <= epsilon) {
    return "north";
  }

  if (rect.y + rect.height >= room.height - epsilon) {
    return "south";
  }

  if (rect.x <= epsilon) {
    return "west";
  }

  if (rect.x + rect.width >= room.width - epsilon) {
    return "east";
  }

  return "south";
};

export const createDoorFrontZone = (
  rect: NormalizedRect,
  room: Room,
  distance: number
): NormalizedRect => {
  // 규정에서 말하는 "문 전방 n cm"를 실제 검사용 직사각형 영역으로 만든다.
  const wall = detectDoorWall(rect, room);

  if (wall === "north") {
    return {
      ...rect,
      id: `${rect.id}-front-zone`,
      name: `${rect.name} 전방`,
      x: rect.x,
      y: rect.y + rect.height,
      width: rect.width,
      height: distance,
      centerX: rect.centerX,
      centerY: rect.y + rect.height + distance / 2
    };
  }

  if (wall === "south") {
    return {
      ...rect,
      id: `${rect.id}-front-zone`,
      name: `${rect.name} 전방`,
      x: rect.x,
      y: Math.max(0, rect.y - distance),
      width: rect.width,
      height: distance,
      centerX: rect.centerX,
      centerY: Math.max(0, rect.y - distance) + distance / 2
    };
  }

  if (wall === "west") {
    return {
      ...rect,
      id: `${rect.id}-front-zone`,
      name: `${rect.name} 전방`,
      x: rect.x + rect.width,
      y: rect.y,
      width: distance,
      height: rect.height,
      centerX: rect.x + rect.width + distance / 2,
      centerY: rect.centerY
    };
  }

  return {
    ...rect,
    id: `${rect.id}-front-zone`,
    name: `${rect.name} 전방`,
    x: Math.max(0, rect.x - distance),
    y: rect.y,
    width: distance,
    height: rect.height,
    centerX: Math.max(0, rect.x - distance) + distance / 2,
    centerY: rect.centerY
  };
};

export const createBandRect = (
  room: Room,
  axis: "horizontal_band" | "vertical_band",
  bandStart: number,
  bandThickness: number
): NormalizedRect => {
  // 통로 검사는 자유 형태 탐색이 아니라, MVP에서 지정된 밴드 영역을 기준으로 수행한다.
  if (axis === "vertical_band") {
    return {
      id: `band-v-${bandStart}`,
      name: "주통로 밴드",
      x: bandStart,
      y: 0,
      width: bandThickness,
      height: room.height,
      centerX: bandStart + bandThickness / 2,
      centerY: room.height / 2,
      kind: "zone",
      category: "zone"
    };
  }

  return {
    id: `band-h-${bandStart}`,
    name: "보조통로 밴드",
    x: 0,
    y: bandStart,
    width: room.width,
    height: bandThickness,
    centerX: room.width / 2,
    centerY: bandStart + bandThickness / 2,
    kind: "zone",
    category: "zone"
  };
};

export const generateElementId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export const createRectangleOutline = (width: number, height: number): Point[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height }
];

export const createBoundarySegmentsFromOutline = (outline: Point[]): RoomBoundarySegment[] =>
  outline.map((point, index) => ({
    kind: "line",
    start: point,
    end: outline[(index + 1) % outline.length]
  }));

const quadraticBezierPoint = (start: Point, control: Point, end: Point, t: number): Point => {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y
  };
};

export const expandBoundarySegmentPoints = (segment: RoomBoundarySegment, arcSteps = 10): Point[] => {
  if (segment.kind === "line") {
    return [segment.start, segment.end];
  }

  const points: Point[] = [segment.start];
  for (let step = 1; step <= arcSteps; step += 1) {
    points.push(quadraticBezierPoint(segment.start, segment.control, segment.end, step / arcSteps));
  }

  return points;
};

export const flattenBoundarySegments = (segments: RoomBoundarySegment[], arcSteps = 10): Point[] => {
  const points: Point[] = [];

  segments.forEach((segment, index) => {
    if (index === 0) {
      points.push(segment.start);
    }

    if (segment.kind === "line") {
      points.push(segment.end);
      return;
    }

    for (let step = 1; step <= arcSteps; step += 1) {
      points.push(quadraticBezierPoint(segment.start, segment.control, segment.end, step / arcSteps));
    }
  });

  return points;
};

export const getRoomWallSections = (segments: RoomBoundarySegment[], arcSteps = 12): RoomWallSection[] => {
  const sections: RoomWallSection[] = [];

  segments.forEach((segment, segmentIndex) => {
    const points = expandBoundarySegmentPoints(segment, arcSteps);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);

      if (length < 1) {
        continue;
      }

      sections.push({
        key: `wall-${segmentIndex}-${index}`,
        start,
        end,
        length,
        sourceKind: segment.kind
      });
    }
  });

  return sections;
};

export const boundarySegmentsToPath = (segments: RoomBoundarySegment[]) => {
  if (segments.length === 0) {
    return "";
  }

  const [first] = segments;
  const commands = [`M ${first.start.x} ${first.start.y}`];

  segments.forEach((segment) => {
    if (segment.kind === "line") {
      commands.push(`L ${segment.end.x} ${segment.end.y}`);
      return;
    }

    commands.push(`Q ${segment.control.x} ${segment.control.y} ${segment.end.x} ${segment.end.y}`);
  });

  commands.push("Z");
  return commands.join(" ");
};

export const buildRoomShapePreset = (
  preset: RoomShapePreset,
  width: number,
  height: number
): { outline: Point[]; boundarySegments: RoomBoundarySegment[] } => {
  const rectangle = createRectangleOutline(width, height);

  if (preset === "rectangle") {
    return {
      outline: rectangle,
      boundarySegments: createBoundarySegmentsFromOutline(rectangle)
    };
  }

  if (preset === "l-shape") {
    const outline = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: Math.round(height * 0.58) },
      { x: Math.round(width * 0.72), y: Math.round(height * 0.58) },
      { x: Math.round(width * 0.72), y: height },
      { x: 0, y: height }
    ];

    return {
      outline,
      boundarySegments: createBoundarySegmentsFromOutline(outline)
    };
  }

  const outline = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: Math.round(width * 0.68), y: height },
    { x: Math.round(width * 0.68), y: Math.round(height * 0.42) },
    { x: Math.round(width * 0.32), y: Math.round(height * 0.42) },
    { x: Math.round(width * 0.32), y: height },
    { x: 0, y: height }
  ];

  return {
    outline,
    boundarySegments: createBoundarySegmentsFromOutline(outline)
  };
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
};

export const getPolygonCentroid = (polygon: Point[]): Point => {
  if (polygon.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = polygon.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length
  };
};

export const getPathBounds = (points: Point[]) => {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

const perpendicularDistance = (point: Point, lineStart: Point, lineEnd: Point) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  return (
    Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) /
    Math.sqrt(dx * dx + dy * dy)
  );
};

export const simplifyPath = (points: Point[], tolerance: number): Point[] => {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let splitIndex = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, splitIndex + 1), tolerance);
    const right = simplifyPath(points.slice(splitIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
};

export const normalizeFreehandOutline = (points: Point[], room: Room): Point[] => {
  const bounded = points.map((point) => ({
    x: Math.max(0, Math.min(room.width, point.x)),
    y: Math.max(0, Math.min(room.height, point.y))
  }));

  const bounds = getPathBounds(bounded);
  if (bounds.width < 60 || bounds.height < 60) {
    return room.outline;
  }

  const simplified = simplifyPath(bounded, 18);
  const unique = simplified.filter((point, index) => {
    if (index === 0) {
      return true;
    }
    const previous = simplified[index - 1];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 12;
  });

  if (unique.length < 3) {
    return [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY }
    ];
  }

  return unique;
};

export const createLineSegment = (start: Point, end: Point): LineSegment => ({
  kind: "line",
  start,
  end
});

export const createArcSegment = (start: Point, end: Point, control: Point): ArcSegment => ({
  kind: "arc",
  start,
  end,
  control
});
