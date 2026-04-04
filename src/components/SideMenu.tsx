import { ReactNode } from "react";

interface SideMenuProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export const SideMenu = ({ open, title, subtitle, onClose, children }: SideMenuProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="side-menu-backdrop" onClick={onClose} role="presentation">
      <aside className="side-menu" onClick={(event) => event.stopPropagation()}>
        <div className="side-menu__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="header-link-button" onClick={onClose} type="button">
            닫기
          </button>
        </div>
        <div className="side-menu__body">{children}</div>
      </aside>
    </div>
  );
};
