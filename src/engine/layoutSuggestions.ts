import { catalogItems } from "../data/catalog";
import { ReviewSummary, SpaceLayout, SuggestionResult } from "../types/layout";
import { clampElementToRoom } from "./geometry";

const createSuggestionFromViolation = (layout: SpaceLayout, review: ReviewSummary): SuggestionResult[] => {
  return review.violations.slice(0, 5).map((violation) => {
    if (violation.ruleId === "door_front_clearance") {
      return {
        title: "문 전방 공간 비우기",
        description:
          "출입문 전방 장애물을 벽면 방향으로 이동해 100cm 이상 비워 두면 주출입과 비상 동선 확보에 유리합니다.",
        impactedElementIds: violation.elementIds
      };
    }

    if (violation.ruleId === "main_corridor_min_width" || violation.ruleId === "sub_corridor_min_width") {
      return {
        title: "통로 밴드 침범 해소",
        description:
          "통로 중심 밴드를 침범하는 가구를 좌우 벽체 쪽으로 정렬하면 통로 폭을 빠르게 회복할 수 있습니다.",
        impactedElementIds: violation.elementIds
      };
    }

    if (violation.ruleId === "collision_basic") {
      return {
        title: "중첩 객체 분리",
        description: "겹친 객체를 개별 벽면 또는 코너 쪽으로 분리 배치해 사용성과 점검 접근성을 확보합니다.",
        impactedElementIds: violation.elementIds
      };
    }

    return {
      title: violation.ruleName,
      description: `${violation.message} 규정 기준을 충족하도록 관련 객체의 위치를 재조정하는 것이 필요합니다.`,
      impactedElementIds: violation.elementIds
    };
  });
};

const shiftElement = (layout: SpaceLayout, elementId: string, nextX: number, nextY: number) => {
  return {
    ...layout,
    elements: layout.elements.map((element) =>
      element.id === elementId ? clampElementToRoom({ ...element, x: nextX, y: nextY }, layout.room) : element
    )
  };
};

export const generateAlternativeLayouts = (layout: SpaceLayout, review: ReviewSummary): SpaceLayout[] => {
  const alternatives: SpaceLayout[] = [];

  const doorViolation = review.violations.find((violation) => violation.ruleId === "door_front_clearance");
  if (doorViolation) {
    const blockingId = doorViolation.elementIds.find((id) => {
      const element = layout.elements.find((item) => item.id === id);
      return element?.kind !== "door";
    });
    const blockingElement = layout.elements.find((element) => element.id === blockingId);

    if (blockingElement) {
      const moved = shiftElement(layout, blockingElement.id, 60, blockingElement.y);
      alternatives.push({
        ...moved,
        id: `${layout.id}-alt-door`,
        name: "대안 1",
        description: `${blockingElement.name}을 좌측 벽면 쪽으로 이동하여 문 전방 공간을 확보한 안`
      });
    }
  }

  const corridorViolation = review.violations.find(
    (violation) => violation.ruleId === "main_corridor_min_width" || violation.ruleId === "sub_corridor_min_width"
  );

  if (corridorViolation) {
    const targetId = corridorViolation.elementIds[0];
    const target = layout.elements.find((element) => element.id === targetId);

    if (target) {
      const nextX = target.x < layout.room.width / 2 ? Math.max(20, target.x - 80) : target.x + 80;
      const moved = shiftElement(layout, target.id, nextX, target.y);
      alternatives.push({
        ...moved,
        id: `${layout.id}-alt-corridor`,
        name: "대안 2",
        description: `${target.name}을 통로 밴드 밖으로 이동하여 중심 통로를 회복하는 안`
      });
    }
  }

  if (alternatives.length < 3) {
    const movable = layout.elements.find((element) => element.category === "furniture" && element.kind !== "bed");
    if (movable) {
      const template = catalogItems.find((item) => item.kind === movable.kind);
      const moved = shiftElement(layout, movable.id, layout.room.width - (template?.width ?? movable.width) - 30, movable.y);
      alternatives.push({
        ...moved,
        id: `${layout.id}-alt-balance`,
        name: "대안 3",
        description: `${movable.name}을 외곽으로 재배치해 중앙 사용 공간을 넓히는 균형안`
      });
    }
  }

  return alternatives.slice(0, 3);
};

export const buildImprovementSuggestions = (layout: SpaceLayout, review: ReviewSummary) => {
  if (review.violations.length === 0) {
    return [
      {
        title: "현재 배치 유지 가능",
        description: "MVP 규정 세트 기준으로 주요 수치 위반이 발견되지 않았습니다. 세부 지침만 추가 검토하면 됩니다.",
        impactedElementIds: layout.elements.map((element) => element.id)
      }
    ];
  }

  // 자연어 제안은 위반 결과를 재구성하는 수준으로만 생성한다.
  return createSuggestionFromViolation(layout, review);
};
