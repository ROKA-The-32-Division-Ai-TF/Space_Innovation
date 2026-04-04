const unitBadgeSrc = `${import.meta.env.BASE_URL}32division-badge.svg`;

export const UnitBadge = () => {
  return <img src={unitBadgeSrc} alt="32사단 마크" className="unit-badge" />;
};
