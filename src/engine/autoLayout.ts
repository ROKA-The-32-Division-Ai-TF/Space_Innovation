import { getDefaultRuleSet, reviewLayout } from "./ruleEngine";
import { AutoLayoutProfile, LayoutElement, ObjectKind, ReviewSummary, SpaceLayout } from "../types/layout";
import {
  clampElementToRoom,
  createDoorFrontZone,
  getElementDimensions,
  getIntersectionHeight,
  getIntersectionWidth,
  getPolygonCentroid,
  normalizeElementRect,
  pointInPolygon
} from "./geometry";

type SpaceArchetype = "barracks" | "office" | "storage" | "generic";
type WallSide = "left" | "right" | "top" | "bottom";
type CandidateVariant = "base" | "mirror-h" | "mirror-v" | "open-center" | "wall-pack";

interface PositionedElement {
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
}

const profileLabels: Record<AutoLayoutProfile, string> = {
  "regulation-first": "규정 우선",
  "movement-first": "동선 우선",
  "capacity-first": "수납 우선"
};

const variantLabels: Record<CandidateVariant, string> = {
  base: "기본안",
  "mirror-h": "좌우 반전안",
  "mirror-v": "상하 반전안",
  "open-center": "중앙 비움안",
  "wall-pack": "벽면 밀착안"
};

const safeInset = 26;

const getBoundingRoomMetrics = (layout: SpaceLayout) => {
  const xs = layout.room.outline.map((point) => point.x);
  const ys = layout.room.outline.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    center: getPolygonCentroid(layout.room.outline)
  };
};

const duplicateLayout = (layout: SpaceLayout): SpaceLayout => structuredClone(layout);

const detectArchetype = (layout: SpaceLayout): SpaceArchetype => {
  const counts = layout.elements.reduce<Record<string, number>>((acc, element) => {
    acc[element.kind] = (acc[element.kind] ?? 0) + 1;
    return acc;
  }, {});

  if ((counts.bed ?? 0) >= 4) {
    return "barracks";
  }

  if ((counts.equipment ?? 0) + (counts.storage ?? 0) >= 3) {
    return "storage";
  }

  if ((counts.desk ?? 0) + (counts.chair ?? 0) >= 3) {
    return "office";
  }

  return "generic";
};

const flipWall = (wall: WallSide, variantSeed: number): WallSide => {
  if (variantSeed % 2 === 1) {
    if (wall === "left") {
      return "right";
    }
    if (wall === "right") {
      return "left";
    }
  }

  if (variantSeed % 3 === 2) {
    if (wall === "top") {
      return "bottom";
    }
    if (wall === "bottom") {
      return "top";
    }
  }

  return wall;
};

const spaceOnWall = (
  layout: SpaceLayout,
  element: LayoutElement,
  wall: WallSide,
  index: number,
  laneGap: number,
  padding = safeInset
): PositionedElement => {
  const { minX, maxX, minY, maxY, center } = getBoundingRoomMetrics(layout);
  const dimensions = getElementDimensions(element);
  const stride = (wall === "left" || wall === "right" ? dimensions.height : dimensions.width) + laneGap;

  const fallback: PositionedElement = {
    x: center.x - dimensions.width / 2,
    y: center.y - dimensions.height / 2,
    rotation: wall === "top" || wall === "bottom" ? 0 : 90
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const offset = index * stride + attempt * 14;
    const candidate: PositionedElement =
      wall === "left"
        ? {
            x: minX + padding,
            y: minY + padding + offset,
            rotation: 90
          }
        : wall === "right"
          ? {
              x: maxX - dimensions.width - padding,
              y: minY + padding + offset,
              rotation: 90
            }
          : wall === "top"
            ? {
                x: minX + padding + offset,
                y: minY + padding,
                rotation: 0
              }
            : {
                x: minX + padding + offset,
                y: maxY - dimensions.height - padding,
                rotation: 0
              };

    const clamped = clampElementToRoom({ ...element, ...candidate }, layout.room);
    const actual = getElementDimensions(clamped);
    const centerPoint = {
      x: clamped.x + actual.width / 2,
      y: clamped.y + actual.height / 2
    };

    if (pointInPolygon(centerPoint, layout.room.outline)) {
      return {
        x: clamped.x,
        y: clamped.y,
        rotation: clamped.rotation
      };
    }
  }

  return fallback;
};

const setElementPlacement = (layout: SpaceLayout, elementId: string, placement: PositionedElement) => {
  layout.elements = layout.elements.map((element) => {
    if (element.id !== elementId) {
      return element;
    }

    return clampElementToRoom(
      {
        ...element,
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation
      },
      layout.room
    );
  });
};

const getElementsByKind = (layout: SpaceLayout, kinds: ObjectKind[]) =>
  layout.elements.filter((element) => kinds.includes(element.kind) && !element.locked);

const arrangeBarracks = (layout: SpaceLayout, profile: AutoLayoutProfile, variantSeed: number) => {
  const beds = getElementsByKind(layout, ["bed"]);
  const lockers = getElementsByKind(layout, ["locker"]);
  const desks = getElementsByKind(layout, ["desk", "chair"]);

  beds.forEach((bed, index) => {
    const baseWall: WallSide =
      profile === "capacity-first"
        ? index % 3 === 0
          ? "left"
          : "right"
        : index % 2 === 0
          ? "left"
          : "right";

    setElementPlacement(
      layout,
      bed.id,
      spaceOnWall(layout, bed, flipWall(baseWall, variantSeed), Math.floor(index / 2), profile === "movement-first" ? 38 : 22)
    );
  });

  lockers.forEach((locker, index) => {
    const baseWall: WallSide =
      profile === "movement-first"
        ? index % 2 === 0
          ? "top"
          : "bottom"
        : index % 2 === 0
          ? "left"
          : "right";

    setElementPlacement(
      layout,
      locker.id,
      spaceOnWall(layout, locker, flipWall(baseWall, variantSeed + 1), Math.floor(index / 2), profile === "regulation-first" ? 24 : 12, 110)
    );
  });

  desks.forEach((item, index) => {
    setElementPlacement(layout, item.id, spaceOnWall(layout, item, flipWall("top", variantSeed), index, 18, 220));
  });
};

const arrangeOffice = (layout: SpaceLayout, profile: AutoLayoutProfile, variantSeed: number) => {
  const desks = getElementsByKind(layout, ["desk"]);
  const chairs = getElementsByKind(layout, ["chair"]);
  const lockers = getElementsByKind(layout, ["locker", "storage"]);

  desks.forEach((desk, index) => {
    const wall: WallSide = profile === "movement-first" ? "top" : index % 2 === 0 ? "left" : "right";
    setElementPlacement(layout, desk.id, spaceOnWall(layout, desk, flipWall(wall, variantSeed), Math.floor(index / (wall === "top" ? 1 : 2)), 32, 70));
  });

  chairs.forEach((chair, index) => {
    const desk = desks[index] ?? desks[index % Math.max(desks.length, 1)];
    if (!desk) {
      return;
    }

    const deskRect = layout.elements.find((item) => item.id === desk.id);
    if (!deskRect) {
      return;
    }

    const dims = getElementDimensions(chair);
    const next = clampElementToRoom(
      {
        ...chair,
        x: deskRect.x + Math.max(8, (deskRect.width - dims.width) / 2),
        y: deskRect.y + deskRect.height + 20 + variantSeed * 4,
        rotation: 0
      },
      layout.room
    );

    setElementPlacement(layout, chair.id, {
      x: next.x,
      y: next.y,
      rotation: next.rotation
    });
  });

  lockers.forEach((locker, index) => {
    const wall: WallSide = profile === "capacity-first" ? "bottom" : "right";
    setElementPlacement(layout, locker.id, spaceOnWall(layout, locker, flipWall(wall, variantSeed), index, 18, 44));
  });
};

const arrangeStorage = (layout: SpaceLayout, profile: AutoLayoutProfile, variantSeed: number) => {
  const large = getElementsByKind(layout, ["equipment", "storage"]);
  const small = getElementsByKind(layout, ["locker", "desk", "chair"]);

  large.forEach((item, index) => {
    const wall: WallSide =
      profile === "movement-first"
        ? index % 2 === 0
          ? "left"
          : "right"
        : profile === "capacity-first"
          ? "top"
          : index % 2 === 0
            ? "left"
            : "top";

    setElementPlacement(layout, item.id, spaceOnWall(layout, item, flipWall(wall, variantSeed), Math.floor(index / 2), profile === "capacity-first" ? 8 : 18, 34));
  });

  small.forEach((item, index) => {
    setElementPlacement(layout, item.id, spaceOnWall(layout, item, flipWall("bottom", variantSeed), index, 16, 36));
  });
};

const arrangeGeneric = (layout: SpaceLayout, profile: AutoLayoutProfile, variantSeed: number) => {
  const furniture = getElementsByKind(layout, ["bed", "locker", "desk", "chair", "storage", "equipment"]);
  const wallOrder: WallSide[] =
    profile === "movement-first"
      ? ["left", "right", "top", "bottom"]
      : profile === "capacity-first"
        ? ["top", "right", "left", "bottom"]
        : ["left", "top", "right", "bottom"];

  furniture.forEach((item, index) => {
    const wall = flipWall(wallOrder[index % wallOrder.length], variantSeed);
    setElementPlacement(layout, item.id, spaceOnWall(layout, item, wall, Math.floor(index / wallOrder.length), 18));
  });
};

const applyProfile = (layout: SpaceLayout, profile: AutoLayoutProfile, variantSeed: number) => {
  const archetype = detectArchetype(layout);

  if (archetype === "barracks") {
    arrangeBarracks(layout, profile, variantSeed);
    return;
  }

  if (archetype === "office") {
    arrangeOffice(layout, profile, variantSeed);
    return;
  }

  if (archetype === "storage") {
    arrangeStorage(layout, profile, variantSeed);
    return;
  }

  arrangeGeneric(layout, profile, variantSeed);
};

const transformUnlockedElements = (layout: SpaceLayout, updater: (element: LayoutElement) => LayoutElement) => {
  layout.elements = layout.elements.map((element) => {
    if (element.locked || element.category === "opening" || element.category === "structure") {
      return element;
    }

    return clampElementToRoom(updater(element), layout.room);
  });
};

const applyVariantTransform = (layout: SpaceLayout, variant: CandidateVariant) => {
  const { center, minX, maxX, minY, maxY } = getBoundingRoomMetrics(layout);

  if (variant === "mirror-h") {
    transformUnlockedElements(layout, (element) => {
      const dimensions = getElementDimensions(element);
      return {
        ...element,
        x: maxX - (element.x - minX) - dimensions.width
      };
    });
    return;
  }

  if (variant === "mirror-v") {
    transformUnlockedElements(layout, (element) => {
      const dimensions = getElementDimensions(element);
      return {
        ...element,
        y: maxY - (element.y - minY) - dimensions.height
      };
    });
    return;
  }

  if (variant === "open-center") {
    transformUnlockedElements(layout, (element) => {
      const dimensions = getElementDimensions(element);
      const elementCenterX = element.x + dimensions.width / 2;
      const elementCenterY = element.y + dimensions.height / 2;
      const dx = elementCenterX - center.x;
      const dy = elementCenterY - center.y;
      const moveX = Math.abs(dx) < 1 ? 0 : dx > 0 ? 26 : -26;
      const moveY = Math.abs(dy) < 1 ? 0 : dy > 0 ? 20 : -20;

      return {
        ...element,
        x: element.x + moveX,
        y: element.y + moveY
      };
    });
    return;
  }

  if (variant === "wall-pack") {
    transformUnlockedElements(layout, (element) => {
      const dimensions = getElementDimensions(element);
      const distances = [
        { wall: "left", value: element.x - minX },
        { wall: "right", value: maxX - (element.x + dimensions.width) },
        { wall: "top", value: element.y - minY },
        { wall: "bottom", value: maxY - (element.y + dimensions.height) }
      ].sort((a, b) => a.value - b.value);

      const nearest = distances[0]?.wall;
      if (nearest === "left") {
        return { ...element, x: minX + 24 };
      }
      if (nearest === "right") {
        return { ...element, x: maxX - dimensions.width - 24 };
      }
      if (nearest === "top") {
        return { ...element, y: minY + 24 };
      }
      return { ...element, y: maxY - dimensions.height - 24 };
    });
  }
};

const severityPenalty = {
  critical: 420,
  major: 220,
  minor: 90
};

const scoreCandidate = (layout: SpaceLayout, review: ReviewSummary, profile: AutoLayoutProfile) => {
  const { center, minX, maxX, minY, maxY } = getBoundingRoomMetrics(layout);
  const centerZone = {
    x: center.x - (maxX - minX) * 0.16,
    y: center.y - (maxY - minY) * 0.16,
    width: (maxX - minX) * 0.32,
    height: (maxY - minY) * 0.32,
    centerX: center.x,
    centerY: center.y,
    id: "center-zone",
    name: "center-zone",
    kind: "zone" as const,
    category: "zone" as const
  };

  const furniture = layout.elements.filter((element) => element.category === "furniture");
  const doors = layout.elements.filter((element) => element.kind === "door");

  const wallPenalty = furniture.reduce((sum, element) => {
    const rect = normalizeElementRect(element);
    const nearestWall = Math.min(rect.x - minX, maxX - (rect.x + rect.width), rect.y - minY, maxY - (rect.y + rect.height));
    return sum + Math.max(nearestWall, 0);
  }, 0);

  const centerPenalty = furniture.reduce((sum, element) => {
    const rect = normalizeElementRect(element);
    const overlapWidth = getIntersectionWidth(centerZone, rect);
    const overlapHeight = getIntersectionHeight(centerZone, rect);
    return sum + overlapWidth * overlapHeight;
  }, 0);

  const doorPenalty = doors.reduce((sum, door) => {
    const zone = createDoorFrontZone(normalizeElementRect(door), layout.room, 140);
    const blockedArea = furniture.reduce((blocked, element) => {
      const rect = normalizeElementRect(element);
      return blocked + getIntersectionWidth(zone, rect) * getIntersectionHeight(zone, rect);
    }, 0);

    return sum + blockedArea;
  }, 0);

  const reviewPenalty = review.violations.reduce((sum, violation) => sum + severityPenalty[violation.severity], 0);

  const profileWeight =
    profile === "regulation-first"
      ? { review: 1.35, center: 0.9, door: 1.3, wall: 0.7 }
      : profile === "movement-first"
        ? { review: 1.1, center: 1.4, door: 1.45, wall: 0.55 }
        : { review: 0.95, center: 0.55, door: 0.9, wall: 1.25 };

  return review.compliantScore * 140 - reviewPenalty * profileWeight.review - centerPenalty * profileWeight.center * 0.01 - doorPenalty * profileWeight.door * 0.03 - wallPenalty * profileWeight.wall;
};

const describeProfile = (profile: AutoLayoutProfile, review: ReviewSummary, variant: CandidateVariant) => {
  const suffix =
    review.violations.length === 0
      ? "현재 규칙 세트 기준 주요 위반 없이 생성되었습니다."
      : `${review.violations.length}건의 위반이 남아 있으며 후속 미세조정이 필요합니다.`;

  const variantText = `${variantLabels[variant]}을 선택한 결과입니다.`;

  if (profile === "regulation-first") {
    return `문 전방과 중앙 통로를 우선 확보하는 생성안입니다. ${variantText} ${suffix}`;
  }

  if (profile === "movement-first") {
    return `중앙 이동 동선과 회전 여유를 넓히는 생성안입니다. ${variantText} ${suffix}`;
  }

  return `외곽 수납 밀도를 높이고 중앙 활용 공간을 남기는 생성안입니다. ${variantText} ${suffix}`;
};

const buildCandidate = (layout: SpaceLayout, profile: AutoLayoutProfile, variant: CandidateVariant, variantSeed: number) => {
  const ruleSet = getDefaultRuleSet();
  const candidate = duplicateLayout(layout);
  applyProfile(candidate, profile, variantSeed);
  applyVariantTransform(candidate, variant);
  const review = reviewLayout(candidate, ruleSet);
  const score = scoreCandidate(candidate, review, profile);

  return {
    candidate,
    review,
    score,
    variant
  };
};

export const generateRoomGptLayouts = (layout: SpaceLayout) => {
  const profiles: AutoLayoutProfile[] = ["regulation-first", "movement-first", "capacity-first"];
  const variants: CandidateVariant[] = ["base", "mirror-h", "mirror-v", "open-center", "wall-pack"];

  return profiles.map((profile, index) => {
    const ranked = variants
      .map((variant, variantSeed) => buildCandidate(layout, profile, variant, variantSeed))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];

    return {
      ...best.candidate,
      id: `${layout.id}-${profile}`,
      name: `자동안 ${index + 1}`,
      description: `${profileLabels[profile]} · ${describeProfile(profile, best.review, best.variant)}`
    };
  });
};
