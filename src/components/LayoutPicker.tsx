import { useMemo, useState } from "react";
import { SpaceLayout } from "../types/layout";
import { UnitBadge } from "./UnitBadge";

export interface LayoutTemplateOption {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  previewLabel: string;
  create: () => SpaceLayout;
}

interface LayoutPickerProps {
  options: LayoutTemplateOption[];
  onSelect: (layout: SpaceLayout) => void;
}

export const LayoutPicker = ({ options, onSelect }: LayoutPickerProps) => {
  const [query, setQuery] = useState("");
  const recommended = options[0];

  const filteredOptions = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return options;
    }

    return options.filter((option) => `${option.title} ${option.subtitle} ${option.description}`.toLowerCase().includes(value));
  }, [options, query]);

  return (
    <section className="layout-picker layout-picker--command">
      <div className="layout-picker__brand">
        <UnitBadge />
      </div>

      <div className="layout-picker__hero layout-picker__hero--center">
        <span className="layout-picker__eyebrow">32사단 공간력 혁신 AI 인테리어</span>
        <h1>어떤 공간부터 설계할까요?</h1>
        <p>복잡한 옵션 대신 공간 유형을 고르고 바로 자동구성을 시작할 수 있습니다.</p>
      </div>

      <div className="layout-picker__search">
        <span className="layout-picker__search-icon">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="생활관, 행정반, 창고, 사용자 정의"
        />
      </div>

      <div className="layout-picker__chips">
        {options.map((option) => (
          <button key={option.id} className="layout-picker__chip" onClick={() => onSelect(option.create())} type="button">
            {option.title}
          </button>
        ))}
      </div>

      <div className="layout-picker__spotlight">
        <div className="layout-picker__spotlight-copy">
          <span className="layout-picker__tag">권장 시작</span>
          <strong>{recommended.title} 자동구성으로 바로 시작</strong>
          <p>{recommended.description}</p>
          <div className="layout-picker__spotlight-actions">
            <button className="primary-button" onClick={() => onSelect(recommended.create())} type="button">
              바로 시작
            </button>
            <button className="ghost-button" onClick={() => onSelect(options[options.length - 1].create())} type="button">
              빈 공간부터
            </button>
          </div>
        </div>
        <div className="layout-picker__spotlight-card">
          <span>{recommended.previewLabel}</span>
          <div className={`layout-template__shape layout-template__shape--${recommended.id}`}></div>
          <ul>
            {recommended.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="layout-picker__grid layout-picker__grid--simple">
        {filteredOptions.map((option) => (
          <button key={option.id} className="layout-template layout-template--simple" onClick={() => onSelect(option.create())} type="button">
            <div className="layout-template__preview">
              <div className={`layout-template__shape layout-template__shape--${option.id}`}></div>
              <span>{option.previewLabel}</span>
            </div>
            <div className="layout-template__body">
              <strong>{option.title}</strong>
              <em>{option.subtitle}</em>
              <p>{option.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
