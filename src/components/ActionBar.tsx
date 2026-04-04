interface ActionBarItem {
  key: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface ActionBarProps {
  items: ActionBarItem[];
  primaryDisabled?: boolean;
  primaryLabel: string;
  onPrimary: () => void;
}

export const ActionBar = ({ items, primaryDisabled, primaryLabel, onPrimary }: ActionBarProps) => {
  return (
    <div className="action-bar">
      <div className="action-bar__group">
        {items.map((item) => (
          <button
            key={item.key}
            className={item.active ? "action-bar__button action-bar__button--active" : "action-bar__button"}
            disabled={item.disabled}
            onClick={item.onClick}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <button className="action-bar__button action-bar__button--primary" disabled={primaryDisabled} onClick={onPrimary} type="button">
        {primaryLabel}
      </button>
    </div>
  );
};
