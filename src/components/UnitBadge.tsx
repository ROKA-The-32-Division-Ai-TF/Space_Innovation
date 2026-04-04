const unitBadgeSrc = `${import.meta.env.BASE_URL}32division-badge.svg`;

interface UnitBadgeProps {
  onClick?: () => void;
}

export const UnitBadge = ({ onClick }: UnitBadgeProps) => {
  if (onClick) {
    return (
      <button className="unit-badge-button" onClick={onClick} type="button" aria-label="다크모드 전환">
        <img src={unitBadgeSrc} alt="32사단 마크" className="unit-badge" />
      </button>
    );
  }

  return <img src={unitBadgeSrc} alt="32사단 마크" className="unit-badge" />;
};
