import { FormEvent, useMemo, useState } from "react";
import { catalogItems } from "../data/catalog";
import { UnitBadge } from "./UnitBadge";
import { EditorMode, ObjectKind } from "../types/layout";

interface ToolbarProps {
  roomSizeLabel: string;
  elementCount: number;
  ruleCount: number;
  isMobile: boolean;
  editorMode: EditorMode;
  drawKind?: ObjectKind;
  onAddElement: (kind: ObjectKind) => void;
  onSetDrawKind: (kind: ObjectKind) => void;
  onSetEditorMode: (mode: EditorMode) => void;
  onOpenTemplatePicker: () => void;
  onStartBlank: () => void;
  onReset: () => void;
  onReview: () => void;
  onGenerateAlternatives: () => void;
  onApplySmartLayout: () => void;
}

const quickActions = [
  { id: "barracks", label: "생활관 자동구성", action: "smart" },
  { id: "review", label: "규정 다시 검토", action: "review" },
  { id: "room", label: "도면 다시 고르기", action: "template" },
  { id: "empty", label: "빈 공간부터", action: "blank" }
] as const;

export const Toolbar = ({
  roomSizeLabel,
  elementCount,
  ruleCount,
  isMobile,
  editorMode,
  drawKind,
  onAddElement,
  onSetDrawKind,
  onSetEditorMode,
  onOpenTemplatePicker,
  onStartBlank,
  onReset,
  onReview,
  onGenerateAlternatives,
  onApplySmartLayout
}: ToolbarProps) => {
  const [query, setQuery] = useState("");

  const searchableItems = useMemo(
    () =>
      catalogItems.map((item) => ({
        ...item,
        search: `${item.label} ${item.kind}`
      })),
    []
  );

  const runCommand = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!value) {
      onApplySmartLayout();
      return;
    }

    if (value.includes("자동") || value.includes("추천") || value.includes("구성") || value.includes("배치")) {
      onApplySmartLayout();
      return;
    }

    if (value.includes("검토") || value.includes("규정")) {
      onReview();
      return;
    }

    if (value.includes("도면") || value.includes("템플릿")) {
      onOpenTemplatePicker();
      return;
    }

    if (value.includes("빈") || value.includes("직접")) {
      onStartBlank();
      return;
    }

    const match = searchableItems.find((item) => value.includes(item.kind) || value.includes(item.label));
    if (match) {
      onAddElement(match.kind);
      return;
    }

    onApplySmartLayout();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    runCommand(query);
    setQuery("");
  };

  return (
    <header className="toolbar toolbar--search">
      <div className="toolbar-search">
        <div className="toolbar-search__brand">
          <UnitBadge />
          <div>
            <span className="toolbar-search__eyebrow">32사단 기반 워크스페이스</span>
            <h1>32사단 공간력 혁신 AI 인테리어</h1>
            <p>군 생활관, 사무실, 창고를 규정과 동선 기준으로 빠르게 설계하는 실무형 편집기</p>
          </div>
        </div>

        <form className="command-bar" onSubmit={handleSubmit}>
          <button className="command-bar__icon" type="submit" aria-label="명령 실행">
            ⌕
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="생활관 자동구성, 침상 추가, 규정 검토처럼 바로 입력"
          />
          <button className="primary-button command-bar__action" type="submit">
            실행
          </button>
        </form>

        <div className="quick-chip-row">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className="quick-chip"
              type="button"
              onClick={() => {
                if (action.action === "smart") {
                  onApplySmartLayout();
                  return;
                }
                if (action.action === "review") {
                  onReview();
                  return;
                }
                if (action.action === "template") {
                  onOpenTemplatePicker();
                  return;
                }
                onStartBlank();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-status">
        <div className="stat-pill">
          <span>방 크기</span>
          <strong>{roomSizeLabel}</strong>
        </div>
        <div className="stat-pill">
          <span>배치 객체</span>
          <strong>{elementCount}개</strong>
        </div>
        <div className="stat-pill">
          <span>활성 규칙</span>
          <strong>{ruleCount}개</strong>
        </div>
      </div>

      {isMobile ? (
        <details className="toolbar-drawer">
          <summary>작업 도구 열기</summary>
          <div className="toolbar-controls toolbar-controls--drawer">
            <div className="toolbar-section">
              <span className="toolbar-section__label">작업 방식</span>
              <div className="segmented-control">
                <button
                  className={editorMode === "select" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                  onClick={() => onSetEditorMode("select")}
                  type="button"
                >
                  선택
                </button>
                <button
                  className={editorMode === "draw-element" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                  onClick={() => onSetEditorMode("draw-element")}
                  type="button"
                >
                  가구 그리기
                </button>
                <button
                  className={editorMode === "draw-room" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                  onClick={() => onSetEditorMode("draw-room")}
                  type="button"
                >
                  공간 그리기
                </button>
              </div>
            </div>

            <div className="toolbar-section">
              <span className="toolbar-section__label">가구 빠른 추가</span>
              <div className="quick-furniture-row">
                {catalogItems.slice(0, 6).map((item) => (
                  <button
                    key={item.kind}
                    className={editorMode === "draw-element" && drawKind === item.kind ? "quick-furniture quick-furniture--active" : "quick-furniture"}
                    onClick={() => (editorMode === "draw-element" ? onSetDrawKind(item.kind) : onAddElement(item.kind))}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-section toolbar-section--actions">
              <span className="toolbar-section__label">추천 작업</span>
              <div className="toolbar-actions-row">
                <button className="primary-button" onClick={onApplySmartLayout} type="button">
                  AI 자동 구성
                </button>
                <button className="ghost-button" onClick={onGenerateAlternatives} type="button">
                  대안 3개 보기
                </button>
                <button className="ghost-button" onClick={onReset} type="button">
                  초기화
                </button>
              </div>
            </div>
          </div>
        </details>
      ) : (
        <div className="toolbar-controls">
          <div className="toolbar-section">
            <span className="toolbar-section__label">작업 방식</span>
            <div className="segmented-control">
              <button
                className={editorMode === "select" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                onClick={() => onSetEditorMode("select")}
                type="button"
              >
                선택
              </button>
              <button
                className={editorMode === "draw-element" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                onClick={() => onSetEditorMode("draw-element")}
                type="button"
              >
                가구 그리기
              </button>
              <button
                className={editorMode === "draw-room" ? "segmented-control__button segmented-control__button--active" : "segmented-control__button"}
                onClick={() => onSetEditorMode("draw-room")}
                type="button"
              >
                공간 그리기
              </button>
            </div>
          </div>

          <div className="toolbar-section">
            <span className="toolbar-section__label">가구 빠른 추가</span>
            <div className="quick-furniture-row">
              {catalogItems.slice(0, 6).map((item) => (
                <button
                  key={item.kind}
                  className={editorMode === "draw-element" && drawKind === item.kind ? "quick-furniture quick-furniture--active" : "quick-furniture"}
                  onClick={() => (editorMode === "draw-element" ? onSetDrawKind(item.kind) : onAddElement(item.kind))}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-section toolbar-section--actions">
            <span className="toolbar-section__label">추천 작업</span>
            <div className="toolbar-actions-row">
              <button className="primary-button" onClick={onApplySmartLayout} type="button">
                AI 자동 구성
              </button>
              <button className="ghost-button" onClick={onGenerateAlternatives} type="button">
                대안 3개 보기
              </button>
              <button className="ghost-button" onClick={onReset} type="button">
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
