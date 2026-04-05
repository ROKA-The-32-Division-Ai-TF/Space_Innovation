import { WorkflowStep } from "../types/layout";
import { UnitBadge } from "./UnitBadge";

interface StepHeaderProps {
  currentStep: WorkflowStep;
  currentHint: string;
  selectedSpaceLabel?: string;
  serverStatusLabel: string;
  serverStatusTone: "idle" | "checking" | "connected" | "error";
  onChangeSpace: () => void;
  onToggleTheme: () => void;
}

const stepItems: { id: WorkflowStep; label: string }[] = [
  { id: "space", label: "공간 선택" },
  { id: "room", label: "구조 생성" },
  { id: "openings", label: "문/창문" },
  { id: "furniture", label: "가구 배치" },
  { id: "review", label: "검토" }
];

export const StepHeader = ({
  currentStep,
  currentHint,
  selectedSpaceLabel,
  serverStatusLabel,
  serverStatusTone,
  onChangeSpace,
  onToggleTheme
}: StepHeaderProps) => {
  const currentIndex = stepItems.findIndex((item) => item.id === currentStep);

  return (
    <header className="step-header">
      <div className="step-header__brand">
        <div className="step-header__badge-stack">
          <UnitBadge onClick={onToggleTheme} />
          <div className={`header-server-status header-server-status--${serverStatusTone}`}>
            <span className="header-server-status__dot" />
            <strong>{serverStatusLabel}</strong>
          </div>
        </div>
        <div className="step-header__copy">
          <span className="step-header__eyebrow">32사단 공간 배치 검토 도구</span>
          <div className="step-header__title-row">
            <h1>{selectedSpaceLabel ? `${selectedSpaceLabel} 배치 검토` : "공간 배치 검토 도구"}</h1>
            {selectedSpaceLabel ? (
              <button className="header-link-button" onClick={onChangeSpace} type="button">
                공간 변경
              </button>
            ) : null}
          </div>
          <p>{currentHint}</p>
        </div>
      </div>

      <ol className="step-progress" aria-label="현재 작업 단계">
        {stepItems.map((item, index) => {
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";

          return (
            <li
              key={item.id}
              className={
                state === "done"
                  ? "step-progress__item step-progress__item--done"
                  : state === "active"
                    ? "step-progress__item step-progress__item--active"
                    : "step-progress__item"
              }
            >
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
            </li>
          );
        })}
      </ol>
    </header>
  );
};
