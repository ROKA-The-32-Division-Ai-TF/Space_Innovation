import { ReviewSummary, SpaceLayout } from "../types/layout";

export interface LayoutNarrative {
  summary: string;
  recommendations: string[];
  regulationDigest: string[];
}

const severityOrder = {
  critical: "중대한 위반",
  major: "주요 위반",
  minor: "경미 위반"
};

export const summarizeRegulationText = (text: string) => {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
};

export const draftRulesFromText = (text: string) => {
  const lines = summarizeRegulationText(text);
  return lines.map((line, index) => ({
    rule_id: `draft-rule-${index + 1}`,
    name: `초안 규칙 ${index + 1}`,
    type: "manual_review",
    sourceText: line,
    note: "실수치와 조건식은 담당자가 검증 후 룰 엔진 형식으로 확정해야 합니다."
  }));
};

export const createLayoutNarrative = (layout: SpaceLayout, review: ReviewSummary): LayoutNarrative => {
  if (review.violations.length === 0) {
    return {
      summary: `${layout.name}은(는) 현재 MVP 규칙 엔진 기준에서 ${review.totalRules}개 규칙을 모두 충족합니다.`,
      recommendations: ["현재 배치를 기준안으로 저장하고, 추가 군 세부 지침을 JSON 규칙으로 확장하는 것을 권장합니다."],
      regulationDigest: ["판정은 규칙 엔진 계산 결과를 기준으로 생성되었습니다."]
    };
  }

  const topViolations = review.violations.slice(0, 3);
  return {
    summary: `${layout.name}은(는) ${review.violations.length}건의 위반이 확인되었고, 규정 준수율은 ${review.compliantScore}%입니다.`,
    recommendations: topViolations.map(
      (violation) =>
        `${severityOrder[violation.severity]}: ${violation.message} 계산상 근거는 ${violation.details}`
    ),
    regulationDigest: [
      "합불 판정은 룰 엔진이 수행합니다.",
      "설명 문장은 계산된 위반 결과만을 재서술합니다.",
      "명시되지 않은 기준 수치는 임의 생성하지 않습니다."
    ]
  };
};
