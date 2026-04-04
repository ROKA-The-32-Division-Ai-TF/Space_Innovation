interface ActionBarProps {
  addActive?: boolean;
  moveActive?: boolean;
  canRotate: boolean;
  canDelete: boolean;
  primaryDisabled?: boolean;
  primaryLabel: string;
  onAdd: () => void;
  onMove: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onPrimary: () => void;
}

export const ActionBar = ({
  addActive,
  moveActive,
  canRotate,
  canDelete,
  primaryDisabled,
  primaryLabel,
  onAdd,
  onMove,
  onRotate,
  onDelete,
  onPrimary
}: ActionBarProps) => {
  return (
    <div className="action-bar">
      <button className={addActive ? "action-bar__button action-bar__button--active" : "action-bar__button"} onClick={onAdd} type="button">
        추가
      </button>
      <button className={moveActive ? "action-bar__button action-bar__button--active" : "action-bar__button"} onClick={onMove} type="button">
        이동
      </button>
      <button className="action-bar__button" disabled={!canRotate} onClick={onRotate} type="button">
        회전
      </button>
      <button className="action-bar__button" disabled={!canDelete} onClick={onDelete} type="button">
        삭제
      </button>
      <button className="action-bar__button action-bar__button--primary" disabled={primaryDisabled} onClick={onPrimary} type="button">
        {primaryLabel}
      </button>
    </div>
  );
};
