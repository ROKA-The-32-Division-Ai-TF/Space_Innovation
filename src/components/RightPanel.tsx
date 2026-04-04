import { LayoutNarrative } from "../ai/explainer";
import { catalogItems } from "../data/catalog";
import { LayoutElement, ReviewSummary, RuleSet, SpaceLayout, SuggestionResult } from "../types/layout";

interface RightPanelProps {
  layout: SpaceLayout;
  ruleSet: RuleSet;
  selectedElement?: LayoutElement;
  review: ReviewSummary;
  narrative: LayoutNarrative;
  suggestions: SuggestionResult[];
  alternatives: SpaceLayout[];
  onUpdateRoom: (field: "width" | "height" | "wallHeight", value: number) => void;
  onUpdateElement: (elementId: string, patch: Partial<LayoutElement>) => void;
  onChooseAlternative: (layout: SpaceLayout) => void;
}

const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const opacityPresets = [
  { label: "투명도 1", value: 1 },
  { label: "투명도 2", value: 0.7 },
  { label: "투명도 3", value: 0.45 }
];

const getVolumeHeight = (element?: LayoutElement, fallback = 90) => {
  if (!element) {
    return fallback;
  }

  const metadata = element.metadata as Record<string, string | number | boolean> | undefined;
  const metadataHeight = metadata?.["volumeHeight"];
  if (typeof metadataHeight === "number") {
    return metadataHeight;
  }

  const catalog = catalogItems.find((item) => item.kind === element.kind);
  return catalog?.volumeHeight ?? fallback;
};

export const RightPanel = ({
  layout,
  ruleSet,
  selectedElement,
  review,
  narrative,
  suggestions,
  alternatives,
  onUpdateRoom,
  onUpdateElement,
  onChooseAlternative
}: RightPanelProps) => {
  const selectedCatalog = selectedElement ? catalogItems.find((item) => item.kind === selectedElement.kind) : undefined;

  return (
    <aside className="side-panel">
      <section className="panel-card">
        <div className="panel-heading">
          <h3>공간 정보</h3>
          <span className="panel-badge">기본 설정</span>
        </div>
        <label>
          가로(cm)
          <input type="number" value={layout.room.width} onChange={(event) => onUpdateRoom("width", numberValue(event.target.value))} />
        </label>
        <label>
          세로(cm)
          <input type="number" value={layout.room.height} onChange={(event) => onUpdateRoom("height", numberValue(event.target.value))} />
        </label>
        <label>
          벽 높이(cm)
          <input
            type="number"
            value={layout.room.wallHeight}
            onChange={(event) => onUpdateRoom("wallHeight", numberValue(event.target.value))}
          />
        </label>
        <div className="meta-block">
          <span>규정 세트</span>
          <strong>{ruleSet.name}</strong>
          <p>{ruleSet.description}</p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <h3>선택 객체 속성</h3>
          <span className="panel-badge">편집</span>
        </div>
        {selectedElement ? (
          <>
            <div className="selected-chip" style={{ backgroundColor: selectedCatalog?.color ?? "#dee2e6" }}>
              {selectedElement.name}
            </div>
            <label>
              이름
              <input
                type="text"
                value={selectedElement.name}
                onChange={(event) => onUpdateElement(selectedElement.id, { name: event.target.value })}
              />
            </label>
            <label>
              X
              <input
                type="number"
                value={Math.round(selectedElement.x)}
                onChange={(event) => onUpdateElement(selectedElement.id, { x: numberValue(event.target.value) })}
              />
            </label>
            <label>
              Y
              <input
                type="number"
                value={Math.round(selectedElement.y)}
                onChange={(event) => onUpdateElement(selectedElement.id, { y: numberValue(event.target.value) })}
              />
            </label>
            <label>
              너비(cm)
              <input
                type="number"
                value={selectedElement.width}
                onChange={(event) => onUpdateElement(selectedElement.id, { width: numberValue(event.target.value) })}
              />
            </label>
            <label>
              높이(cm)
              <input
                type="number"
                value={selectedElement.height}
                onChange={(event) => onUpdateElement(selectedElement.id, { height: numberValue(event.target.value) })}
              />
            </label>
            <label>
              3D 높이(cm)
              <input
                type="number"
                value={getVolumeHeight(selectedElement)}
                onChange={(event) =>
                  onUpdateElement(selectedElement.id, {
                    metadata: {
                      ...selectedElement.metadata,
                      volumeHeight: numberValue(event.target.value)
                    }
                  })
                }
              />
            </label>
            <label>
              회전
              <select
                value={selectedElement.rotation}
                onChange={(event) =>
                  onUpdateElement(selectedElement.id, {
                    rotation: Number(event.target.value) as LayoutElement["rotation"]
                  })
                }
              >
                <option value={0}>0도</option>
                <option value={90}>90도</option>
                <option value={180}>180도</option>
                <option value={270}>270도</option>
              </select>
            </label>
            <label>
              투명도
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={selectedElement.opacity ?? 1}
                onChange={(event) => onUpdateElement(selectedElement.id, { opacity: numberValue(event.target.value) })}
              />
            </label>
            <div className="preset-row">
              {opacityPresets.map((preset) => (
                <button
                  key={preset.label}
                  className={Math.abs((selectedElement.opacity ?? 1) - preset.value) < 0.01 ? "ghost-button ghost-button--active" : "ghost-button"}
                  onClick={() => onUpdateElement(selectedElement.id, { opacity: preset.value })}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="empty-copy">캔버스에서 객체를 선택하면 위치, 크기, 회전과 3D 높이까지 함께 수정할 수 있습니다.</p>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <h3>검토 결과</h3>
          <span className="panel-badge">분석</span>
        </div>
        <div className="score-grid">
          <div>
            <span>규정 준수율</span>
            <strong>{review.compliantScore}%</strong>
          </div>
          <div>
            <span>충족 규칙</span>
            <strong>
              {review.passedRules}/{review.totalRules}
            </strong>
          </div>
        </div>
        <p className="summary-text">{narrative.summary}</p>
        <ul className="list-block">
          {review.violations.length === 0 ? (
            <li>현재 위반 항목이 없습니다.</li>
          ) : (
            review.violations.map((violation) => (
              <li key={violation.id}>
                <strong>[{violation.severity}]</strong> {violation.message}
                <p>{violation.details}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <h3>개선 권고</h3>
          <span className="panel-badge">추천</span>
        </div>
        <ul className="list-block">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.title}-${index}`}>
              <strong>{suggestion.title}</strong>
              <p>{suggestion.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <h3>자동 배치안</h3>
          <span className="panel-badge">비교</span>
        </div>
        {alternatives.length === 0 ? (
          <p className="empty-copy">상단의 RoomGPT형 자동 배치 버튼을 누르면 규정 우선, 동선 우선, 수납 우선 생성안이 만들어집니다.</p>
        ) : (
          <div className="alternatives">
            {alternatives.map((alternative) => (
              <button key={alternative.id} className="alternative-card" onClick={() => onChooseAlternative(alternative)}>
                <strong>{alternative.name}</strong>
                <span>{alternative.description}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
};
