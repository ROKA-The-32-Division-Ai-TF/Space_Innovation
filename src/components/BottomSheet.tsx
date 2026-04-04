import { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export const BottomSheet = ({ open, title, subtitle, onClose, children }: BottomSheetProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose} role="presentation">
      <section
        className="bottom-sheet"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bottom-sheet__handle" />
        <div className="bottom-sheet__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="header-link-button" onClick={onClose} type="button">
            닫기
          </button>
        </div>
        <div className="bottom-sheet__body">{children}</div>
      </section>
    </div>
  );
};
