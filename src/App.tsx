import { useEffect, useMemo, useState } from "react";
import { createLayoutNarrative } from "./ai/explainer";
import { ActionBar } from "./components/ActionBar";
import { BottomSheet } from "./components/BottomSheet";
import { CanvasEditor } from "./components/CanvasEditor";
import { StepHeader } from "./components/StepHeader";
import { catalogItems } from "./data/catalog";
import { sampleBarracksLayout, sampleOfficeLayout, sampleStorageLayout } from "./data/sampleLayouts";
import { exportCanvasToPng } from "./engine/exportPng";
import { generateRoomGptLayouts } from "./engine/autoLayout";
import { buildRoomShapePreset, clampElementToRoom, generateElementId } from "./engine/geometry";
import { buildImprovementSuggestions } from "./engine/layoutSuggestions";
import { getDefaultRuleSet, reviewLayout } from "./engine/ruleEngine";
import {
  BottomSheetMode,
  EditorMode,
  LayoutElement,
  ObjectKind,
  RoomDrawTool,
  RoomShapePreset,
  SpaceLayout,
  WorkflowStep
} from "./types/layout";

type SpaceTypeId = "barracks" | "command" | "lounge" | "storage" | "custom";

interface SpaceTypeOption {
  id: SpaceTypeId;
  label: string;
  description: string;
  template: "barracks" | "office" | "storage" | "custom";
}

const spaceTypeOptions: SpaceTypeOption[] = [
  {
    id: "barracks",
    label: "생활관",
    description: "침상과 캐비닛 중심 생활 공간",
    template: "barracks"
  },
  {
    id: "command",
    label: "지휘통제실",
    description: "책상, 상황판, 장비 배치 중심 공간",
    template: "office"
  },
  {
    id: "lounge",
    label: "간부휴게실",
    description: "책상, 의자, 수납을 간단히 검토하는 공간",
    template: "office"
  },
  {
    id: "storage",
    label: "창고",
    description: "장비함과 점검 통로 중심 공간",
    template: "storage"
  },
  {
    id: "custom",
    label: "사용자 정의",
    description: "공간 유형만 정하고 구조를 직접 만드는 공간",
    template: "custom"
  }
];

const workflowMeta: Record<WorkflowStep, { label: string; hint: string; primaryLabel: string }> = {
  space: {
    label: "공간 선택",
    hint: "공간 유형을 선택하면 구조 생성 단계로 자연스럽게 이어집니다.",
    primaryLabel: "공간 유형 선택"
  },
  room: {
    label: "구조 생성",
    hint: "기본 사각형을 그대로 쓰거나, 가로·세로 수치를 먼저 입력한 뒤 필요할 때만 벽을 수정하세요.",
    primaryLabel: "문/창문 배치로"
  },
  openings: {
    label: "문/창문 배치",
    hint: "출입문과 창문, 고정 구조물을 먼저 두면 이후 검토가 더 정확해집니다.",
    primaryLabel: "가구 배치로"
  },
  furniture: {
    label: "가구 배치",
    hint: "침상, 책상, 캐비닛, 상황판을 두고 손가락으로 바로 위치를 조정해보세요.",
    primaryLabel: "배치 검토"
  },
  review: {
    label: "검토",
    hint: "통로, 문 전방, 밀집도를 색상으로 확인하고 PNG로 바로 내보낼 수 있습니다.",
    primaryLabel: "PNG 내보내기"
  }
};

const openingKinds: ObjectKind[] = ["door", "window", "pillar"];
const furnitureKinds: ObjectKind[] = ["bed", "locker", "desk", "chair", "storage", "equipment", "board"];

const nextRotation = (rotation: LayoutElement["rotation"]): LayoutElement["rotation"] => {
  if (rotation === 0) {
    return 90;
  }

  if (rotation === 90) {
    return 180;
  }

  if (rotation === 180) {
    return 270;
  }

  return 0;
};

const createBlankLayout = (option?: SpaceTypeOption): SpaceLayout => {
  const base =
    option?.template === "office"
      ? structuredClone(sampleOfficeLayout)
      : option?.template === "storage"
        ? structuredClone(sampleStorageLayout)
        : structuredClone(sampleBarracksLayout);

  const label = option?.label ?? "신규 공간";

  return {
    ...base,
    id: `layout-${option?.id ?? "draft"}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${label} 배치안`,
    description: `${label} 공간 배치 검토용 도면`,
    layoutCategory: label,
    room: {
      ...base.room,
      id: `room-${option?.id ?? "draft"}-${Math.random().toString(36).slice(2, 8)}`,
      name: label
    },
    elements: []
  };
};

const App = () => {
  const ruleSet = useMemo(() => getDefaultRuleSet(), []);
  const [layout, setLayout] = useState<SpaceLayout>(() => createBlankLayout());
  const [selectedSpaceType, setSelectedSpaceType] = useState<SpaceTypeOption>();
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("space");
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode | null>("space-type");
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [drawKind, setDrawKind] = useState<ObjectKind>("door");
  const [roomDrawTool, setRoomDrawTool] = useState<RoomDrawTool>("line");
  const [curveDirection, setCurveDirection] = useState<1 | -1>(1);
  const [reviewOverlayVisible, setReviewOverlayVisible] = useState(false);
  const [roomWidthInput, setRoomWidthInput] = useState(800);
  const [roomHeightInput, setRoomHeightInput] = useState(600);
  const [notice, setNotice] = useState<string>();

  const selectedElement = layout.elements.find((element) => element.id === selectedElementId);
  const review = useMemo(() => reviewLayout(layout, ruleSet), [layout, ruleSet]);
  const suggestions = useMemo(() => buildImprovementSuggestions(layout, review).slice(0, 3), [layout, review]);
  const narrative = useMemo(() => createLayoutNarrative(layout, review), [layout, review]);
  const alternatives = useMemo(
    () => (workflowStep === "review" ? generateRoomGptLayouts(layout).slice(0, 3) : []),
    [layout, workflowStep]
  );

  useEffect(() => {
    setReviewOverlayVisible(workflowStep === "review");
  }, [workflowStep]);

  useEffect(() => {
    setRoomWidthInput(layout.room.width);
    setRoomHeightInput(layout.room.height);
  }, [layout.room.height, layout.room.width]);

  useEffect(() => {
    if (!selectedElementId) {
      if (bottomSheetMode === "selection-actions") {
        setBottomSheetMode(workflowStep === "review" ? "review-summary" : null);
      }
      return;
    }

    setBottomSheetMode("selection-actions");
  }, [bottomSheetMode, selectedElementId, workflowStep]);

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

  const updateRoomGeometry = (outline: SpaceLayout["room"]["outline"], boundarySegments: SpaceLayout["room"]["boundarySegments"]) => {
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

    const x = options?.x ?? Math.max(20, layout.room.width / 2 - catalog.width / 2);
    const y = options?.y ?? Math.max(20, layout.room.height / 2 - catalog.height / 2);

    const baseElement: LayoutElement = {
      id: generateElementId(kind),
      name: `${catalog.label} ${layout.elements.filter((element) => element.kind === kind).length + 1}`,
      kind: catalog.kind as LayoutElement["kind"],
      category: catalog.category,
      x,
      y,
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
    setEditorMode("select");
  };

  const deleteSelectedElement = () => {
    if (!selectedElement || selectedElement.locked) {
      return;
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      elements: currentLayout.elements.filter((element) => element.id !== selectedElement.id)
    }));
    setSelectedElementId(undefined);
  };

  const rotateSelectedElement = () => {
    if (!selectedElement) {
      return;
    }

    updateElement(selectedElement.id, {
      rotation: nextRotation(selectedElement.rotation)
    });
  };

  const chooseSpaceType = (option: SpaceTypeOption) => {
    const nextLayout = createBlankLayout(option);
    setSelectedSpaceType(option);
    setLayout(nextLayout);
    setSelectedElementId(undefined);
    setWorkflowStep("room");
    setBottomSheetMode(null);
    setEditorMode("select");
    setDrawKind("door");
    setRoomWidthInput(nextLayout.room.width);
    setRoomHeightInput(nextLayout.room.height);
    setNotice(`${option.label} 기본 사각형 도면을 불러왔습니다. 그대로 사용하거나 가로/세로를 먼저 맞춰보세요.`);
  };

  const openSheetForCurrentStep = () => {
    if (selectedElementId) {
      setBottomSheetMode("selection-actions");
      return;
    }

    if (workflowStep === "space") {
      setBottomSheetMode("space-type");
      return;
    }

    if (workflowStep === "room") {
      setBottomSheetMode("room-shape");
      return;
    }

    if (workflowStep === "review") {
      setBottomSheetMode("review-summary");
      return;
    }

    setBottomSheetMode("object-picker");
  };

  const advanceStep = async () => {
    if (workflowStep === "space") {
      setBottomSheetMode("space-type");
      setNotice("공간 유형을 먼저 선택해주세요.");
      return;
    }

    if (workflowStep === "room") {
      if (layout.room.outline.length < 3 || layout.room.boundarySegments.length < 3) {
        setNotice("닫힌 공간 외곽선이 있어야 다음 단계로 이동할 수 있습니다.");
        return;
      }

      setWorkflowStep("openings");
      setBottomSheetMode("object-picker");
      setDrawKind("door");
      setEditorMode("select");
      setSelectedElementId(undefined);
      setNotice("문과 창문을 배치해주세요.");
      return;
    }

    if (workflowStep === "openings") {
      const hasDoor = layout.elements.some((element) => element.kind === "door");
      setWorkflowStep("furniture");
      setBottomSheetMode("object-picker");
      setDrawKind("bed");
      setEditorMode("select");
      setSelectedElementId(undefined);
      setNotice(hasDoor ? "가구를 추가해보세요." : "문이 없는 상태로 가구 배치 단계로 이동했습니다. 필요하면 문을 먼저 추가하세요.");
      return;
    }

    if (workflowStep === "furniture") {
      setWorkflowStep("review");
      setBottomSheetMode("review-summary");
      setEditorMode("select");
      setSelectedElementId(undefined);
      setNotice("검토 결과를 확인하고 PNG로 내보낼 수 있습니다.");
      return;
    }

    const svgElement = document.getElementById("layout-export-surface") as SVGSVGElement | null;
    if (!svgElement) {
      setNotice("도면을 내보낼 수 있는 캔버스를 찾지 못했습니다.");
      return;
    }

    try {
      await exportCanvasToPng({
        svgElement,
        fileName: `${selectedSpaceType?.label ?? "space-layout"}-${Date.now()}.png`,
        title: `${selectedSpaceType?.label ?? layout.room.name} · ${layout.name}`,
        subtitle: `규정 준수율 ${review.compliantScore}% · 위반 ${review.violations.length}건`
      });
      setBottomSheetMode("export");
      setNotice("PNG 이미지를 다운로드했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PNG 내보내기에 실패했습니다.");
    }
  };

  const currentHint = workflowMeta[workflowStep].hint;
  const primaryLabel = workflowMeta[workflowStep].primaryLabel;
  const canDelete = Boolean(selectedElement && !selectedElement.locked);
  const canRotate = Boolean(selectedElement);
  const primaryDisabled = false;
  const currentPickerKinds = workflowStep === "openings" ? openingKinds : furnitureKinds;
  const actionBarItems =
    workflowStep === "space"
      ? [
          {
            key: "space",
            label: "공간",
            active: bottomSheetMode === "space-type",
            onClick: () => setBottomSheetMode("space-type")
          }
        ]
      : workflowStep === "room"
        ? [
            {
              key: "shape",
              label: "도면",
              active: bottomSheetMode === "room-shape",
              onClick: () => setBottomSheetMode("room-shape")
            },
            {
              key: "size",
              label: "치수",
              onClick: () => {
                setBottomSheetMode(null);
                setNotice("가로와 세로 수치를 먼저 맞춘 뒤 다음 단계로 넘어가면 가장 쉽습니다.");
              }
            },
            {
              key: "advanced",
              label: "고급 벽 수정",
              active: editorMode === "draw-room",
              onClick: () => {
                setBottomSheetMode("room-shape");
                setNotice("특수 구조일 때만 직선 벽이나 곡선 벽 수정을 사용하세요.");
              }
            }
          ]
        : workflowStep === "review"
          ? [
              {
                key: "review",
                label: "결과",
                active: bottomSheetMode === "review-summary",
                onClick: () => setBottomSheetMode("review-summary")
              },
              {
                key: "select",
                label: "선택",
                active: editorMode === "select",
                onClick: () => {
                  setEditorMode("select");
                  setBottomSheetMode(null);
                }
              }
            ]
          : [
              {
                key: "add",
                label: "추가",
                active: bottomSheetMode === "object-picker",
                onClick: openSheetForCurrentStep
              },
              {
                key: "select",
                label: "선택",
                active: editorMode === "select",
                onClick: () => {
                  setEditorMode("select");
                  if (selectedElementId) {
                    setBottomSheetMode("selection-actions");
                  } else {
                    setBottomSheetMode(null);
                  }
                }
              },
              ...(canRotate
                ? [
                    {
                      key: "rotate",
                      label: "회전",
                      onClick: rotateSelectedElement
                    }
                  ]
                : []),
              ...(canDelete
                ? [
                    {
                      key: "delete",
                      label: "삭제",
                      onClick: deleteSelectedElement
                    }
                  ]
                : [])
            ];

  const addKindFromSheet = (kind: ObjectKind) => {
    setDrawKind(kind);
    createElement(kind);
    setBottomSheetMode(null);
  };

  const applyRoomPreset = (preset: RoomShapePreset, width = roomWidthInput, height = roomHeightInput) => {
    const nextWidth = Math.max(300, Math.round(width / 20) * 20);
    const nextHeight = Math.max(300, Math.round(height / 20) * 20);
    const geometry = buildRoomShapePreset(preset, nextWidth, nextHeight);

    setLayout((currentLayout) => {
      const nextRoom = {
        ...currentLayout.room,
        width: nextWidth,
        height: nextHeight,
        outline: geometry.outline,
        boundarySegments: geometry.boundarySegments
      };

      return {
        ...currentLayout,
        room: nextRoom,
        elements: currentLayout.elements.map((element) => clampElementToRoom(element, nextRoom))
      };
    });

    setRoomWidthInput(nextWidth);
    setRoomHeightInput(nextHeight);
    setEditorMode("select");
    setNotice(`${preset === "rectangle" ? "사각형" : preset === "l-shape" ? "L자" : "U자"} 도면을 ${nextWidth} x ${nextHeight}cm 기준으로 적용했습니다.`);
  };

  return (
    <div className="app-shell">
      <StepHeader
        currentStep={workflowStep}
        currentHint={currentHint}
        selectedSpaceLabel={selectedSpaceType?.label}
        onChangeSpace={() => {
          setWorkflowStep("space");
          setBottomSheetMode("space-type");
          setSelectedElementId(undefined);
          setNotice("다른 공간 유형을 선택할 수 있습니다.");
        }}
      />

      {notice ? <div className="notice-banner">{notice}</div> : null}

      <main className="planner-shell">
        <section className="planner-stage">
          {workflowStep === "space" && !selectedSpaceType ? (
            <div className="stage-empty-card">
              <strong>공간 유형을 선택해주세요.</strong>
              <p>생활관, 지휘통제실, 간부휴게실, 창고 중 하나를 고르면 구조 생성 단계가 바로 열립니다.</p>
              <button className="primary-button" onClick={() => setBottomSheetMode("space-type")} type="button">
                공간 유형 고르기
              </button>
            </div>
          ) : null}

          {workflowStep === "room" ? (
            <div className="room-start-card">
              <div className="room-start-card__copy">
                <strong>먼저 기본 도면을 정하세요.</strong>
                <p>오토캐드처럼 정확하게 시작하려면 가로·세로 수치를 먼저 넣고, 필요할 때만 벽을 한 줄씩 수정하는 흐름이 가장 쉽습니다.</p>
              </div>

              <div className="room-dimension-row">
                <label className="room-dimension-field">
                  가로(cm)
                  <input
                    type="number"
                    min={300}
                    step={20}
                    value={roomWidthInput}
                    onChange={(event) => setRoomWidthInput(Number(event.target.value) || layout.room.width)}
                  />
                </label>
                <label className="room-dimension-field">
                  세로(cm)
                  <input
                    type="number"
                    min={300}
                    step={20}
                    value={roomHeightInput}
                    onChange={(event) => setRoomHeightInput(Number(event.target.value) || layout.room.height)}
                  />
                </label>
                <button className="primary-button" onClick={() => applyRoomPreset("rectangle")} type="button">
                  사각형 적용
                </button>
              </div>

              <div className="room-action-row">
                <button className="sheet-chip" onClick={() => void advanceStep()} type="button">
                  기본 도면 그대로 사용
                </button>
                <button className="sheet-chip" onClick={() => applyRoomPreset("l-shape")} type="button">
                  L자 도면
                </button>
                <button className="sheet-chip" onClick={() => applyRoomPreset("u-shape")} type="button">
                  U자 도면
                </button>
                <button
                  className="sheet-chip"
                  onClick={() => {
                    setBottomSheetMode("room-shape");
                    setNotice("직접 벽을 그릴 필요가 있을 때만 고급 벽 수정 메뉴를 열어주세요.");
                  }}
                  type="button"
                >
                  고급 벽 수정
                </button>
              </div>

              <ol className="room-helper-list">
                <li>기본은 현재 사각형 도면 그대로 이어가면 됩니다.</li>
                <li>정확한 수치가 있으면 가로·세로만 먼저 입력하세요.</li>
                <li>특수 구조일 때만 직선 벽 또는 곡선 벽으로 외곽을 다시 그리면 됩니다.</li>
              </ol>
            </div>
          ) : null}

          <CanvasEditor
            layout={layout}
            selectedElementId={selectedElementId}
            editorMode={editorMode}
            drawKind={drawKind}
            helperText={currentHint}
            roomDrawTool={roomDrawTool}
            curveDirection={curveDirection}
            review={review}
            showReviewOverlay={reviewOverlayVisible}
            onSelectElement={setSelectedElementId}
            onUpdateElement={updateElement}
            onCreateElement={(kind, rect) => createElement(kind, rect)}
            onUpdateRoomGeometry={updateRoomGeometry}
          />
        </section>
      </main>

      <ActionBar
        items={actionBarItems}
        primaryDisabled={primaryDisabled}
        primaryLabel={primaryLabel}
        onPrimary={() => {
          void advanceStep();
        }}
      />

      <BottomSheet
        open={bottomSheetMode === "space-type"}
        title="공간 유형을 선택해주세요"
        subtitle="공간 특성에 맞는 기본 구조와 추천 배치 흐름을 준비합니다."
        onClose={() => setBottomSheetMode(null)}
      >
        <div className="sheet-option-grid">
          {spaceTypeOptions.map((option) => (
            <button key={option.id} className="sheet-option-card" onClick={() => chooseSpaceType(option)} type="button">
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={bottomSheetMode === "room-shape"}
        title="도면 구조를 설정해주세요"
        subtitle="기본 사각형과 수치 입력을 우선 쓰고, 직접 벽 그리기는 특수 공간일 때만 사용하는 편이 모바일에서 훨씬 쉽습니다."
        onClose={() => setBottomSheetMode(null)}
      >
        <div className="sheet-section">
          <span className="sheet-section__label">기본 치수</span>
          <div className="selection-form__row">
            <label>
              가로(cm)
              <input
                type="number"
                min={300}
                step={20}
                value={roomWidthInput}
                onChange={(event) => setRoomWidthInput(Number(event.target.value) || layout.room.width)}
              />
            </label>
            <label>
              세로(cm)
              <input
                type="number"
                min={300}
                step={20}
                value={roomHeightInput}
                onChange={(event) => setRoomHeightInput(Number(event.target.value) || layout.room.height)}
              />
            </label>
          </div>
        </div>

        <div className="sheet-section">
          <span className="sheet-section__label">기본 형태</span>
          <div className="sheet-inline-grid">
            {(["rectangle", "l-shape", "u-shape"] as RoomShapePreset[]).map((preset) => (
              <button key={preset} className="sheet-chip" onClick={() => applyRoomPreset(preset, roomWidthInput, roomHeightInput)} type="button">
                {preset === "rectangle" ? "사각형" : preset === "l-shape" ? "L자" : "U자"}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-section">
          <span className="sheet-section__label">고급 벽 수정</span>
          <p className="sheet-section__helper">비정형 공간일 때만 사용하세요. 일반적인 생활관이나 사무공간은 위 기본 도형만으로 시작하는 편이 더 쉽습니다.</p>
          <div className="sheet-inline-grid">
            <button className={roomDrawTool === "line" ? "sheet-chip sheet-chip--active" : "sheet-chip"} onClick={() => {
              setRoomDrawTool("line");
              setEditorMode("draw-room");
              setBottomSheetMode(null);
              setNotice("직선 벽 모드입니다. 시작점을 누르고 벽을 한 줄씩 이어가세요.");
            }} type="button">
              직선 벽
            </button>
            <button className={roomDrawTool === "arc" ? "sheet-chip sheet-chip--active" : "sheet-chip"} onClick={() => {
              setRoomDrawTool("arc");
              setEditorMode("draw-room");
              setBottomSheetMode(null);
              setNotice("곡선 벽 모드입니다. 시작점을 누르고 곡선을 이어가세요.");
            }} type="button">
              곡선 벽
            </button>
            <button className={curveDirection === 1 ? "sheet-chip sheet-chip--active" : "sheet-chip"} onClick={() => setCurveDirection(1)} type="button">
              곡률 A
            </button>
            <button className={curveDirection === -1 ? "sheet-chip sheet-chip--active" : "sheet-chip"} onClick={() => setCurveDirection(-1)} type="button">
              곡률 B
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={bottomSheetMode === "object-picker"}
        title={workflowStep === "openings" ? "문과 창문을 추가해주세요" : "배치 요소를 추가해주세요"}
        subtitle={workflowStep === "openings" ? "문, 창문, 기둥을 먼저 두면 검토 정확도가 높아집니다." : "필요한 가구를 추가한 뒤 손가락으로 위치를 조정할 수 있습니다."}
        onClose={() => setBottomSheetMode(null)}
      >
        <div className="sheet-option-grid">
          {currentPickerKinds.map((kind) => {
            const item = catalogItems.find((catalogItem) => catalogItem.kind === kind);
            if (!item) {
              return null;
            }

            return (
              <button key={kind} className="sheet-option-card" onClick={() => addKindFromSheet(kind)} type="button">
                <strong>{item.label}</strong>
                <p>
                  기본 크기 {item.width} x {item.height}cm
                </p>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        open={bottomSheetMode === "selection-actions" && Boolean(selectedElement)}
        title={selectedElement ? `${selectedElement.name} 편집` : "선택 요소 편집"}
        subtitle="이름, 크기, 회전만 간단히 다루고 세부 속성은 최대한 숨깁니다."
        onClose={() => {
          setBottomSheetMode(null);
          setSelectedElementId(undefined);
        }}
      >
        {selectedElement ? (
          <div className="selection-form">
            <label>
              이름
              <input
                type="text"
                value={selectedElement.name}
                onChange={(event) => updateElement(selectedElement.id, { name: event.target.value })}
              />
            </label>
            <div className="selection-form__row">
              <label>
                너비(cm)
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(event) => updateElement(selectedElement.id, { width: Number(event.target.value) || selectedElement.width })}
                />
              </label>
              <label>
                높이(cm)
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(event) => updateElement(selectedElement.id, { height: Number(event.target.value) || selectedElement.height })}
                />
              </label>
            </div>
            <div className="sheet-inline-grid">
              <button className="sheet-chip" onClick={rotateSelectedElement} type="button">
                90도 회전
              </button>
              <button className="sheet-chip" disabled={!canDelete} onClick={deleteSelectedElement} type="button">
                삭제
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={bottomSheetMode === "review-summary"}
        title="배치 검토 결과"
        subtitle="핵심 위반과 권고만 우선 보여주고, 상세 수치는 최소한으로 유지합니다."
        onClose={() => setBottomSheetMode(null)}
      >
        <div className="review-summary">
          <div className="review-summary__hero">
            <div>
              <span>규정 준수율</span>
              <strong>{review.compliantScore}%</strong>
            </div>
            <div>
              <span>충족 규칙</span>
              <strong>
                {review.passedRules}/{review.totalRules}
              </strong>
            </div>
          </div>

          <p className="review-summary__text">{narrative.summary}</p>

          <section className="sheet-section">
            <span className="sheet-section__label">주요 위반</span>
            <div className="review-list">
              {review.violations.length === 0 ? (
                <div className="review-item review-item--safe">
                  <strong>위반 항목이 없습니다.</strong>
                  <p>현재 배치는 룰 엔진 기준에서 주요 규칙을 충족하고 있습니다.</p>
                </div>
              ) : (
                review.violations.slice(0, 3).map((violation) => (
                  <div
                    key={violation.id}
                    className={
                      violation.severity === "critical"
                        ? "review-item review-item--danger"
                        : violation.severity === "major"
                          ? "review-item review-item--warning"
                          : "review-item review-item--safe"
                    }
                  >
                    <strong>{violation.message}</strong>
                    <p>{violation.details}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="sheet-section">
            <span className="sheet-section__label">개선 권고</span>
            <div className="review-list">
              {suggestions.slice(0, 3).map((suggestion) => (
                <div key={suggestion.title} className="review-item">
                  <strong>{suggestion.title}</strong>
                  <p>{suggestion.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="sheet-section">
            <span className="sheet-section__label">추천 배치안</span>
            <div className="sheet-option-grid">
              {alternatives.map((alternative) => (
                <button
                  key={alternative.id}
                  className="sheet-option-card"
                  onClick={() => {
                    setLayout(structuredClone(alternative));
                    setSelectedElementId(undefined);
                    setNotice(`${alternative.name}을(를) 적용했습니다.`);
                  }}
                  type="button"
                >
                  <strong>{alternative.name}</strong>
                  <p>{alternative.description}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </BottomSheet>

      <BottomSheet
        open={bottomSheetMode === "export"}
        title="PNG 내보내기 완료"
        subtitle="현재 보이는 도면과 검토 오버레이를 하나의 PNG 이미지로 저장했습니다."
        onClose={() => setBottomSheetMode(null)}
      >
        <div className="review-item review-item--safe">
          <strong>다운로드가 시작되었습니다.</strong>
          <p>캔버스 영역만 이미지로 저장되며, 공간 유형과 준수율 요약이 상단에 함께 들어갑니다.</p>
        </div>
      </BottomSheet>
    </div>
  );
};

export default App;
