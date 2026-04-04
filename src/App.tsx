import { useEffect, useMemo, useState } from "react";
import { createLayoutNarrative, draftRulesFromText, summarizeRegulationText } from "./ai/explainer";
import { CanvasEditor } from "./components/CanvasEditor";
import { LayoutPicker, LayoutTemplateOption } from "./components/LayoutPicker";
import { RightPanel } from "./components/RightPanel";
import { ShellOpacityMode, ThreeDPreview } from "./components/ThreeDPreview";
import { Toolbar } from "./components/Toolbar";
import { catalogItems } from "./data/catalog";
import {
  createCustomTemplateLayout,
  sampleBarracksLayout,
  sampleOfficeLayout,
  sampleStorageLayout
} from "./data/sampleLayouts";
import { generateRoomGptLayouts } from "./engine/autoLayout";
import { buildImprovementSuggestions } from "./engine/layoutSuggestions";
import { clampElementToRoom, generateElementId } from "./engine/geometry";
import { getDefaultRuleSet, reviewLayout } from "./engine/ruleEngine";
import { EditorMode, LayoutElement, ObjectKind, Point, RoomBoundarySegment, SpaceLayout } from "./types/layout";

const regulationInput = `주통로는 120cm 이상 확보한다.
보조통로는 80cm 이상 확보한다.
출입문 전방 100cm 이내에는 장애물을 두지 않는다.
침상 간 최소 60cm 이격거리를 유지한다.
장비함은 출입문 주변 120cm 이내에 두지 않는다.`;

const initialLayout = structuredClone(sampleBarracksLayout);

const templateOptions: LayoutTemplateOption[] = [
  {
    id: "barracks",
    title: "생활관",
    subtitle: "8인 생활관 기준",
    description: "침상과 관물대 중심 배치를 빠르게 검토할 수 있는 기본 템플릿입니다.",
    highlights: ["생활관형 비정형 외곽선", "침상 8개/관물대 배치", "통로·문 전방 규정 검토"],
    previewLabel: "Barracks",
    create: () => structuredClone(sampleBarracksLayout)
  },
  {
    id: "office",
    title: "사무실",
    subtitle: "행정반/대기실형",
    description: "책상, 의자, 서류함 중심의 업무 공간 템플릿입니다.",
    highlights: ["업무 좌석 중심", "사무용 가구 배치", "문 접근성과 동선 확인"],
    previewLabel: "Office",
    create: () => structuredClone(sampleOfficeLayout)
  },
  {
    id: "storage",
    title: "창고",
    subtitle: "장비 보관형",
    description: "장비함, 보관함, 점검 통로를 중심으로 시작하는 안전형 템플릿입니다.",
    highlights: ["장비 보관 시나리오", "대형 가구 배치", "창고 안전 여유 공간 검토"],
    previewLabel: "Storage",
    create: () => structuredClone(sampleStorageLayout)
  },
  {
    id: "custom",
    title: "사용자 정의",
    subtitle: "빈 방 윤곽선 그리기",
    description: "직선 벽과 곡선 벽을 골라가며 실제 건물 윤곽처럼 방 외곽을 직접 그릴 수 있습니다.",
    highlights: ["직선/곡선 벽 선택", "가구 직접 배치", "비정형 공간 설계"],
    previewLabel: "Custom",
    create: () => createCustomTemplateLayout()
  }
];

const scalePoint = (point: Point, scaleX: number, scaleY: number): Point => ({
  x: Math.round(point.x * scaleX),
  y: Math.round(point.y * scaleY)
});

const scaleBoundarySegment = (segment: RoomBoundarySegment, scaleX: number, scaleY: number): RoomBoundarySegment => {
  if (segment.kind === "line") {
    return {
      ...segment,
      start: scalePoint(segment.start, scaleX, scaleY),
      end: scalePoint(segment.end, scaleX, scaleY)
    };
  }

  return {
    ...segment,
    start: scalePoint(segment.start, scaleX, scaleY),
    end: scalePoint(segment.end, scaleX, scaleY),
    control: scalePoint(segment.control, scaleX, scaleY)
  };
};

const App = () => {
  const ruleSet = useMemo(() => getDefaultRuleSet(), []);
  const [layout, setLayout] = useState<SpaceLayout>(initialLayout);
  const [showTemplatePicker, setShowTemplatePicker] = useState(true);
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [alternatives, setAlternatives] = useState<SpaceLayout[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [drawKind, setDrawKind] = useState<ObjectKind>("bed");
  const [shellOpacityMode, setShellOpacityMode] = useState<ShellOpacityMode>("opacity-1");
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 780 : false));
  const [mobileView, setMobileView] = useState<"plan" | "three-d" | "analysis">("plan");

  const review = useMemo(() => reviewLayout(layout, ruleSet), [layout, ruleSet]);
  const suggestions = useMemo(() => buildImprovementSuggestions(layout, review), [layout, review]);
  const narrative = useMemo(() => createLayoutNarrative(layout, review), [layout, review]);
  const selectedElement = layout.elements.find((element) => element.id === selectedElementId);
  const regulationSummary = summarizeRegulationText(regulationInput);
  const draftRules = draftRulesFromText(regulationInput);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 780px)");
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsMobile(event ? event.matches : mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const updateElement = (elementId: string, patch: Partial<LayoutElement>) => {
    setLayout((currentLayout) => ({
      ...currentLayout,
      elements: currentLayout.elements.map((element) => {
        if (element.id !== elementId) {
          return element;
        }

        return clampElementToRoom(
          {
            ...element,
            ...patch
          } as LayoutElement,
          currentLayout.room
        );
      })
    }));
  };

  const updateElementHeight = (elementId: string, value: number) => {
    const target = layout.elements.find((element) => element.id === elementId);
    if (!target) {
      return;
    }

    updateElement(elementId, {
      metadata: {
        ...target.metadata,
        volumeHeight: Math.max(20, Math.min(260, value))
      }
    });
  };

  const updateRoom = (field: "width" | "height" | "wallHeight", value: number) => {
    setLayout((currentLayout) => {
      if (field === "wallHeight") {
        return {
          ...currentLayout,
          room: {
            ...currentLayout.room,
            wallHeight: Math.max(180, Math.min(420, value))
          }
        };
      }

      const nextWidth = field === "width" ? Math.max(300, value) : currentLayout.room.width;
      const nextHeight = field === "height" ? Math.max(300, value) : currentLayout.room.height;
      const scaleX = nextWidth / currentLayout.room.width;
      const scaleY = nextHeight / currentLayout.room.height;
      const outline = currentLayout.room.outline.map((point) => scalePoint(point, scaleX, scaleY));
      const boundarySegments = currentLayout.room.boundarySegments.map((segment) => scaleBoundarySegment(segment, scaleX, scaleY));
      const nextRoom = {
        ...currentLayout.room,
        width: nextWidth,
        height: nextHeight,
        outline,
        boundarySegments
      };

      return {
        ...currentLayout,
        room: nextRoom,
        elements: currentLayout.elements.map((element) => clampElementToRoom(element, nextRoom))
      };
    });
  };

  const updateRoomGeometry = (outline: Point[], boundarySegments: RoomBoundarySegment[]) => {
    setLayout((currentLayout) => ({
      ...currentLayout,
      room: {
        ...currentLayout.room,
        outline,
        boundarySegments
      },
      elements: currentLayout.elements.map((element) =>
        clampElementToRoom(element, {
          ...currentLayout.room,
          outline,
          boundarySegments
        })
      )
    }));
    setEditorMode("select");
  };

  const addElement = (kind: ObjectKind) => {
    createElement(kind, { x: 40, y: 40 });
  };

  const createElement = (
    kind: ObjectKind,
    options?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  ) => {
    const catalog = catalogItems.find((item) => item.kind === kind);
    if (!catalog) {
      return;
    }

    const baseElement: LayoutElement = {
      id: generateElementId(kind),
      name: `${catalog.label} ${layout.elements.filter((element) => element.kind === kind).length + 1}`,
      kind: catalog.kind as LayoutElement["kind"],
      category: catalog.category,
      x: options?.x ?? 40,
      y: options?.y ?? 40,
      width: options?.width ?? catalog.width,
      height: options?.height ?? catalog.height,
      rotation: 0,
      opacity: 1,
      metadata: {
        ...(catalog.metadata ?? {}),
        volumeHeight: catalog.volumeHeight
      }
    } as LayoutElement;

    const nextElement = clampElementToRoom(baseElement, layout.room);

    setLayout((currentLayout) => ({
      ...currentLayout,
      elements: [...currentLayout.elements, nextElement]
    }));
    setSelectedElementId(nextElement.id);
  };

  const resetLayout = () => {
    setLayout(structuredClone(sampleBarracksLayout));
    setAlternatives([]);
    setSelectedElementId(undefined);
    setEditorMode("select");
  };

  const generateAlternatives = () => {
    setAlternatives(generateRoomGptLayouts(layout));
  };

  const applySmartLayout = () => {
    const generated = generateRoomGptLayouts(layout);
    setAlternatives(generated);

    const best = [...generated].sort((a, b) => {
      const reviewA = reviewLayout(a, ruleSet);
      const reviewB = reviewLayout(b, ruleSet);

      if (reviewB.compliantScore !== reviewA.compliantScore) {
        return reviewB.compliantScore - reviewA.compliantScore;
      }

      return reviewA.violations.length - reviewB.violations.length;
    })[0];

    if (best) {
      setLayout(structuredClone(best));
      setSelectedElementId(undefined);
    }
  };

  const startBlank = () => {
    const customLayout = createCustomTemplateLayout();
    setLayout(customLayout);
    setSelectedElementId(undefined);
    setAlternatives([]);
    setEditorMode("draw-room");
    setMobileView("plan");
    setShowTemplatePicker(false);
  };

  const explanatoryPanel = (
    <section className="panel-card system-card">
      <h3>LLM 역할 분리 예시</h3>
      <p>
        아래 내용은 실제 판정이 아니라, 규정 문장을 구조화된 룰 초안으로 바꾸기 위한 보조 정보입니다. 최종 합불 판정은 상단의 룰 엔진
        계산 결과를 기준으로 합니다.
      </p>
      <div className="two-column">
        <div>
          <h4>규정 요약</h4>
          <ul className="list-block">
            {regulationSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>구조화 룰 초안</h4>
          <pre>{JSON.stringify(draftRules, null, 2)}</pre>
        </div>
      </div>
    </section>
  );

  const planPanel = (
    <section className="workspace">
      <CanvasEditor
        layout={layout}
        selectedElementId={selectedElementId}
        editorMode={editorMode}
        drawKind={drawKind}
        onSelectElement={setSelectedElementId}
        onUpdateElement={updateElement}
        onCreateElement={(kind, rect) => createElement(kind, rect)}
        onUpdateRoomGeometry={updateRoomGeometry}
      />
    </section>
  );

  const threeDPanel = (
    <section className="workspace">
      <ThreeDPreview
        layout={layout}
        selectedElement={selectedElement}
        selectedElementId={selectedElementId}
        shellOpacityMode={shellOpacityMode}
        onChangeShellOpacityMode={setShellOpacityMode}
        onUpdateRoomWallHeight={(value) => updateRoom("wallHeight", value)}
        onUpdateElementHeight={updateElementHeight}
      />
    </section>
  );

  const analysisPanel = (
    <section className="workspace">
      <RightPanel
        layout={layout}
        ruleSet={ruleSet}
        selectedElement={selectedElement}
        review={review}
        narrative={narrative}
        suggestions={suggestions}
        alternatives={alternatives}
        onUpdateRoom={updateRoom}
        onUpdateElement={updateElement}
        onChooseAlternative={(alternative) => {
          setLayout(structuredClone(alternative));
          setSelectedElementId(undefined);
          setMobileView("plan");
        }}
      />
      {explanatoryPanel}
    </section>
  );

  return (
    <div className="app-shell">
      {showTemplatePicker ? (
        <LayoutPicker
          options={templateOptions}
          onSelect={(nextLayout) => {
            setLayout(nextLayout);
            setSelectedElementId(undefined);
            setAlternatives([]);
            setEditorMode(nextLayout.elements.length === 0 ? "draw-room" : "select");
            setMobileView("plan");
            setShowTemplatePicker(false);
          }}
        />
      ) : null}

      <Toolbar
        roomSizeLabel={`${layout.room.width} x ${layout.room.height}cm`}
        elementCount={layout.elements.length}
        ruleCount={ruleSet.rules.length}
        isMobile={isMobile}
        editorMode={editorMode}
        drawKind={drawKind}
        onAddElement={addElement}
        onSetDrawKind={setDrawKind}
        onSetEditorMode={setEditorMode}
        onOpenTemplatePicker={() => setShowTemplatePicker(true)}
        onStartBlank={startBlank}
        onReset={resetLayout}
        onReview={() => setLayout((current) => ({ ...current }))}
        onGenerateAlternatives={generateAlternatives}
        onApplySmartLayout={applySmartLayout}
      />

      {!showTemplatePicker && isMobile ? (
        <nav className="mobile-tabs" aria-label="모바일 작업 전환">
          <button
            className={mobileView === "plan" ? "mobile-tabs__button mobile-tabs__button--active" : "mobile-tabs__button"}
            onClick={() => setMobileView("plan")}
            type="button"
          >
            도면
          </button>
          <button
            className={mobileView === "three-d" ? "mobile-tabs__button mobile-tabs__button--active" : "mobile-tabs__button"}
            onClick={() => setMobileView("three-d")}
            type="button"
          >
            3D
          </button>
          <button
            className={mobileView === "analysis" ? "mobile-tabs__button mobile-tabs__button--active" : "mobile-tabs__button"}
            onClick={() => setMobileView("analysis")}
            type="button"
          >
            분석
          </button>
        </nav>
      ) : null}

      <main className="main-layout">
        {isMobile ? (
          mobileView === "plan" ? (
            planPanel
          ) : mobileView === "three-d" ? (
            threeDPanel
          ) : (
            analysisPanel
          )
        ) : (
          <>
            <section className="workspace">
              <CanvasEditor
                layout={layout}
                selectedElementId={selectedElementId}
                editorMode={editorMode}
                drawKind={drawKind}
                onSelectElement={setSelectedElementId}
                onUpdateElement={updateElement}
                onCreateElement={(kind, rect) => createElement(kind, rect)}
                onUpdateRoomGeometry={updateRoomGeometry}
              />

              <ThreeDPreview
                layout={layout}
                selectedElement={selectedElement}
                selectedElementId={selectedElementId}
                shellOpacityMode={shellOpacityMode}
                onChangeShellOpacityMode={setShellOpacityMode}
                onUpdateRoomWallHeight={(value) => updateRoom("wallHeight", value)}
                onUpdateElementHeight={updateElementHeight}
              />

              {explanatoryPanel}
            </section>

            <RightPanel
              layout={layout}
              ruleSet={ruleSet}
              selectedElement={selectedElement}
              review={review}
              narrative={narrative}
              suggestions={suggestions}
              alternatives={alternatives}
              onUpdateRoom={updateRoom}
              onUpdateElement={updateElement}
              onChooseAlternative={(alternative) => {
                setLayout(structuredClone(alternative));
                setSelectedElementId(undefined);
              }}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
