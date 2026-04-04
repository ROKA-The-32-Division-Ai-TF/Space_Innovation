import ruleSetJson from "../data/rules.json";
import {
  CollisionRule,
  CorridorBandRule,
  DoorClearanceRule,
  LayoutElement,
  MinDistanceRule,
  RestrictedZoneRule,
  ReviewSummary,
  RuleDefinition,
  RuleSet,
  RuleViolation,
  SpaceLayout
} from "../types/layout";
import {
  createBandRect,
  createDoorFrontZone,
  getEdgeDistance,
  getIntersectionHeight,
  getIntersectionWidth,
  normalizeElementRect,
  rectsOverlap
} from "./geometry";

const defaultRuleSet = ruleSetJson as RuleSet;

const blockKinds: LayoutElement["kind"][] = ["bed", "locker", "desk", "chair", "storage", "equipment", "pillar"];

const createViolation = (
  rule: RuleDefinition,
  message: string,
  details: string,
  elementIds: string[],
  metric?: number
): RuleViolation => ({
  id: `${rule.rule_id}-${elementIds.join("-")}-${Math.random().toString(36).slice(2, 6)}`,
  ruleId: rule.rule_id,
  ruleName: rule.name,
  severity: rule.severity,
  message,
  details,
  elementIds,
  metric
});

const evaluateCollisionRule = (elements: LayoutElement[], rule: CollisionRule) => {
  // 모든 대상 객체 쌍을 비교해 중첩 여부를 계산한다.
  const targets = elements.filter((element) => rule.targetKinds.includes(element.kind));
  const violations: RuleViolation[] = [];

  for (let i = 0; i < targets.length; i += 1) {
    const a = normalizeElementRect(targets[i]);

    for (let j = i + 1; j < targets.length; j += 1) {
      const b = normalizeElementRect(targets[j]);

      if (rectsOverlap(a, b)) {
        violations.push(
          createViolation(
            rule,
            `${targets[i].name}과 ${targets[j].name}이(가) 서로 겹칩니다.`,
            `${targets[i].name}과 ${targets[j].name}의 배치가 중첩되어 실제 사용이 어렵습니다.`,
            [targets[i].id, targets[j].id]
          )
        );
      }
    }
  }

  return violations;
};

const evaluateDoorClearanceRule = (layout: SpaceLayout, rule: DoorClearanceRule) => {
  // 문 전방 금지 영역과 가구 사각형이 겹치면 바로 위반으로 처리한다.
  const doors = layout.elements.filter((element) => element.kind === "door");
  const candidates = layout.elements.filter((element) => rule.applyToKinds.includes(element.kind));
  const violations: RuleViolation[] = [];

  for (const door of doors) {
    const doorRect = normalizeElementRect(door);
    const zone = createDoorFrontZone(doorRect, layout.room, rule.distance);

    for (const candidate of candidates) {
      const rect = normalizeElementRect(candidate);
      if (rectsOverlap(zone, rect)) {
        violations.push(
          createViolation(
            rule,
            `${door.name} 전방 ${rule.distance}cm 이내에 ${candidate.name}이(가) 있습니다.`,
            `문 전방 여유공간을 ${candidate.name}이(가) 침범하여 출입과 비상 동선이 저해됩니다.`,
            [door.id, candidate.id]
          )
        );
      }
    }
  }

  return violations;
};

const evaluateCorridorBandRule = (layout: SpaceLayout, rule: CorridorBandRule) => {
  // 통로 폭은 밴드 전체를 비워두는 방식으로 단순화하고, 최대 침범치를 기준으로 유효 폭을 계산한다.
  const band = createBandRect(layout.room, rule.target, rule.bandStart, rule.bandThickness);
  const blockers = layout.elements
    .filter((element) => blockKinds.includes(element.kind))
    .map(normalizeElementRect)
    .filter((rect) => rectsOverlap(band, rect));

  let maxIntrusion = 0;
  const offendingIds: string[] = [];

  for (const blocker of blockers) {
    const intrusion =
      rule.target === "vertical_band"
        ? getIntersectionWidth(band, blocker)
        : getIntersectionHeight(band, blocker);

    if (intrusion > maxIntrusion) {
      maxIntrusion = intrusion;
    }

    offendingIds.push(blocker.id);
  }

  const freeWidth = Math.max(rule.bandThickness - maxIntrusion, 0);

  if (freeWidth >= rule.value) {
    return [];
  }

  return [
    createViolation(
      rule,
      `${rule.name} 기준 ${rule.value}cm를 충족하지 못했습니다.`,
      `통로 밴드 내 최대 침범 폭이 ${maxIntrusion.toFixed(
        0
      )}cm로 계산되어 실제 확보 폭이 약 ${freeWidth.toFixed(0)}cm입니다.`,
      offendingIds,
      freeWidth
    )
  ];
};

const evaluateMinDistanceRule = (elements: LayoutElement[], rule: MinDistanceRule) => {
  // 침상 간 간격처럼 종류 간 최소 이격거리를 검사할 때 사용한다.
  const source = elements.filter((element) => rule.sourceKinds.includes(element.kind));
  const others = elements.filter((element) => rule.otherKinds.includes(element.kind));
  const violations: RuleViolation[] = [];

  for (const sourceElement of source) {
    const sourceRect = normalizeElementRect(sourceElement);

    for (const otherElement of others) {
      if (sourceElement.id === otherElement.id) {
        continue;
      }

      if (sourceElement.id > otherElement.id) {
        continue;
      }

      const otherRect = normalizeElementRect(otherElement);
      const distance = getEdgeDistance(sourceRect, otherRect);

      if (distance < rule.value) {
        violations.push(
          createViolation(
            rule,
            `${sourceElement.name}과 ${otherElement.name} 간 이격거리가 부족합니다.`,
            `현재 최소 간격은 약 ${distance.toFixed(0)}cm이며, 기준은 ${rule.value}cm입니다.`,
            [sourceElement.id, otherElement.id],
            distance
          )
        );
      }
    }
  }

  return violations;
};

const evaluateRestrictedZoneRule = (layout: SpaceLayout, rule: RestrictedZoneRule) => {
  // 출입문 주변 특정 거리 이내에 두면 안 되는 대형 장비류를 검출한다.
  const doors = layout.elements.filter((element) => element.kind === "door");
  const restricted = layout.elements.filter((element) => rule.restrictedKinds.includes(element.kind));
  const violations: RuleViolation[] = [];

  for (const door of doors) {
    const zone = createDoorFrontZone(normalizeElementRect(door), layout.room, rule.distance);

    for (const element of restricted) {
      const rect = normalizeElementRect(element);
      if (rectsOverlap(zone, rect)) {
        violations.push(
          createViolation(
            rule,
            `${element.name}이(가) ${door.name} 주변 제한 구역에 배치되었습니다.`,
            `${door.name} 인접 ${rule.distance}cm 구역은 대형 장비/보관물 배치 제한 구역입니다.`,
            [door.id, element.id]
          )
        );
      }
    }
  }

  return violations;
};

export const getDefaultRuleSet = () => defaultRuleSet;

export const reviewLayout = (layout: SpaceLayout, ruleSet: RuleSet = defaultRuleSet): ReviewSummary => {
  // 최종 판정은 LLM이 아니라 이 규칙 엔진이 수행한다.
  const violations: RuleViolation[] = [];

  for (const rule of ruleSet.rules) {
    if (rule.type === "collision_constraint") {
      violations.push(...evaluateCollisionRule(layout.elements, rule));
      continue;
    }

    if (rule.type === "door_clearance") {
      violations.push(...evaluateDoorClearanceRule(layout, rule));
      continue;
    }

    if (rule.type === "corridor_band_min_width") {
      violations.push(...evaluateCorridorBandRule(layout, rule));
      continue;
    }

    if (rule.type === "min_distance_between_kinds") {
      violations.push(...evaluateMinDistanceRule(layout.elements, rule));
      continue;
    }

    if (rule.type === "restricted_zone") {
      violations.push(...evaluateRestrictedZoneRule(layout, rule));
    }
  }

  const violatedRules = new Set(violations.map((violation) => violation.ruleId));
  const totalRules = ruleSet.rules.length;
  const passedRules = totalRules - violatedRules.size;

  return {
    compliantScore: Math.max(0, Math.round((passedRules / totalRules) * 100)),
    totalRules,
    passedRules,
    violations
  };
};
