import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "./components/ActionBar";
import { BottomSheet } from "./components/BottomSheet";
import { CanvasEditor } from "./components/CanvasEditor";
import { SideMenu } from "./components/SideMenu";
import { StepHeader } from "./components/StepHeader";
import { catalogItems } from "./data/catalog";
import { sampleBarracksLayout, sampleOfficeLayout, sampleStorageLayout } from "./data/sampleLayouts";
import { buildAnalyzeRequest } from "./engine/analyzeAdapter";
import { exportCanvasToPng } from "./engine/exportPng";
import { buildRoomShapePreset, clampElementToRoom, generateElementId } from "./engine/geometry";
import { analyzeWithGuiServer, checkGuiServerHealth, loadInitialApiBaseUrl, normalizeApiBaseUrl, saveApiBaseUrl, validateApiBaseUrl } from "./engine/guiServer";
import { AnalyzeResponse } from "./types/analyze";
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
    primaryLabel: "공간"
  },
  room: {
    label: "구조 생성",
    hint: "기본 사각형을 그대로 쓰거나, 가로·세로 수치를 먼저 입력한 뒤 필요할 때만 벽을 수정하세요.",
    primaryLabel: "문/창문"
  },
  openings: {
    label: "문/창문 배치",
    hint: "출입문과 창문, 고정 구조물을 먼저 두면 이후 검토가 더 정확해집니다.",
    primaryLabel: "가구"
  },
  furniture: {
    label: "가구 배치",
    hint: "침상, 책상, 캐비닛, 상황판을 두고 손가락으로 바로 위치를 조정해보세요.",
    primaryLabel: "검토"
  },
  review: {
    label: "검토",
    hint: "GUI 서버가 반환한 점수와 문제 구역을 확인하고, 현재 화면 그대로 PNG로 내보낼 수 있습니다.",
    primaryLabel: "PNG"
  }
};

const serverStatusMeta = {
  idle: { label: "연결 안 됨", tone: "idle" },
  checking: { label: "확인 중", tone: "checking" },
  connected: { label: "연결됨", tone: "connected" },
  error: { label: "오류", tone: "error" }
} as const;

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
  const [layout, setLayout] = useState<SpaceLayout>(() => createBlankLayout());
  const [selectedSpaceType, setSelectedSpaceType] = useState<SpaceTypeOption>();
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("space");
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [drawKind, setDrawKind] = useState<ObjectKind>("door");
  const [roomDrawTool, setRoomDrawTool] = useState<RoomDrawTool>("line");
  const [curveDirection, setCurveDirection] = useState<1 | -1>(1);
  const [roomWidthInput, setRoomWidthInput] = useState(800);
  const [roomHeightInput, setRoomHeightInput] = useState(600);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [apiBaseUrl, setApiBaseUrl] = useState(() => loadInitialApiBaseUrl());
  const [serverStatus, setServerStatus] = useState<"idle" | "checking" | "connected" | "error">("idle");
  const [serverError, setServerError] = useState<string>();
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string>();
  const [lastAnalyzedLayoutKey, setLastAnalyzedLayoutKey] = useState<string>();
  const hasAttemptedAutoConnect = useRef(false);

  const selectedElement = layout.elements.find((element) => element.id === selectedElementId);
  const analyzePayload = useMemo(
    () => buildAnalyzeRequest(layout, selectedSpaceType?.label ?? layout.layoutCategory),
    [layout, selectedSpaceType?.label]
  );
  const currentLayoutKey = useMemo(() => JSON.stringify(analyzePayload), [analyzePayload]);
  const isAnalysisCurrent = Boolean(analysisResult && analysisStatus === "success" && lastAnalyzedLayoutKey === currentLayoutKey);
  const reviewSummary = isAnalysisCurrent ? analysisResult : null;
  const serverStatusInfo = serverStatusMeta[serverStatus];

  useEffect(() => {
    document.body.classList.toggle("theme-dark", isDarkMode);
    return () => {
      document.body.classList.remove("theme-dark");
    };
  }, [isDarkMode]);

  useEffect(() => {
    setRoomWidthInput(layout.room.width);
    setRoomHeightInput(layout.room.height);
  }, [layout.room.height, layout.room.width]);

  useEffect(() => {
    saveApiBaseUrl(apiBaseUrl);
    setServerStatus((current) => (current === "connected" || current === "error" ? "idle" : current));
    setServerError(undefined);
    setAnalysisStatus("idle");
    setAnalysisResult(null);
    setAnalysisError(undefined);
    setLastAnalyzedLayoutKey(undefined);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl || hasAttemptedAutoConnect.current) {
      return;
    }

    hasAttemptedAutoConnect.current = true;
    void checkServerConnection(true);
  }, [apiBaseUrl]);

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

  const openServerMenu = (message?: string) => {
    setSideMenuOpen(true);
    if (message) {
      setNotice(message);
    }
  };

  const checkServerConnection = async (silent = false) => {
    try {
      const normalized = validateApiBaseUrl(apiBaseUrl);
      setApiBaseUrl(normalized);
      setServerStatus("checking");
      setServerError(undefined);
      const health = await checkGuiServerHealth(normalized);
      setServerStatus("connected");
      if (!silent) {
        setNotice(health.version ? `GUI 서버에 연결되었습니다. (${health.version})` : "GUI 서버에 연결되었습니다.");
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "서버에 연결할 수 없습니다.";
      setServerStatus("error");
      setServerError(message);
      if (!silent) {
        setNotice(message);
      }
      return false;
    }
  };

  const runServerAnalysis = async () => {
    if (serverStatus !== "connected") {
      openServerMenu("검토 전 GUI 서버 연결 확인이 필요합니다.");
      return;
    }

    setAnalysisStatus("loading");
    setAnalysisError(undefined);

    try {
      const nextResult = await analyzeWithGuiServer(apiBaseUrl, analyzePayload);
      setAnalysisResult(nextResult);
      setAnalysisStatus("success");
      setLastAnalyzedLayoutKey(currentLayoutKey);
      setBottomSheetMode("review-summary");
      setNotice("서버 분석 결과를 불러왔습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "배치 분석에 실패했습니다.";
      setAnalysisStatus("error");
      setAnalysisError(message);
      setLastAnalyzedLayoutKey(undefined);
      setNotice(message);
    }
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
    setSideMenuOpen(false);
    setAnalysisStatus("idle");
    setAnalysisResult(null);
    setAnalysisError(undefined);
    setLastAnalyzedLayoutKey(undefined);
    setNotice(`${option.label} 기본 사각형 도면을 불러왔습니다. 그대로 사용하거나 가로/세로를 먼저 맞춰보세요.`);
  };

  const resetCurrentLayout = () => {
    const nextLayout = createBlankLayout(selectedSpaceType);
    setLayout(nextLayout);
    setSelectedElementId(undefined);
    setEditorMode("select");
    setBottomSheetMode(workflowStep === "space" ? "space-type" : null);
    setRoomWidthInput(nextLayout.room.width);
    setRoomHeightInput(nextLayout.room.height);
    setAnalysisStatus("idle");
    setAnalysisResult(null);
    setAnalysisError(undefined);
    setLastAnalyzedLayoutKey(undefined);
    setNotice("현재 공간을 초기 상태로 되돌렸습니다.");
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

  const confirmOpeningsStep = () => {
    const hasDoor = layout.elements.some((element) => element.kind === "door");
    setWorkflowStep("furniture");
    setBottomSheetMode("object-picker");
    setDrawKind("bed");
    setEditorMode("select");
    setSelectedElementId(undefined);
    setNotice(hasDoor ? "문/창문 배치를 확정했습니다. 이제 가구를 추가해보세요." : "문 없이 확정했습니다. 필요하면 이전 단계로 돌아가 문을 추가할 수 있습니다.");
  };

  const confirmFurnitureStep = () => {
    setWorkflowStep("review");
    setBottomSheetMode("review-summary");
    setEditorMode("select");
    setSelectedElementId(undefined);
    setNotice("가구 배치를 확정했습니다. 이제 검토 결과를 확인할 수 있습니다.");
  };

  const advanceStep = async () => {
    if (workflowStep === "space") {
      setSideMenuOpen(true);
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

    if (!isAnalysisCurrent) {
      await runServerAnalysis();
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
        subtitle: `검토 점수 ${reviewSummary?.score ?? 0}점 · 이슈 ${reviewSummary?.issues.length ?? 0}건`
      });
      setBottomSheetMode("export");
      setNotice("PNG 이미지를 다운로드했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PNG 내보내기에 실패했습니다.");
    }
  };

  const currentHint = workflowMeta[workflowStep].hint;
  const primaryLabel =
    workflowStep === "openings"
      ? "추가"
      : workflowStep === "furniture"
        ? "추가"
        : workflowStep === "review"
          ? (analysisStatus === "loading" ? "분석 중..." : isAnalysisCurrent ? "PNG" : "분석")
          : workflowMeta[workflowStep].primaryLabel;
  const canDelete = Boolean(selectedElement && !selectedElement.locked);
  const canRotate = Boolean(selectedElement);
  const primaryDisabled = analysisStatus === "loading";
  const currentPickerKinds = workflowStep === "openings" ? openingKinds : furnitureKinds;
  const canEditElement = Boolean(selectedElement);
  const actionBarItems =
    workflowStep === "space"
      ? [
          {
            key: "menu",
            label: "메뉴",
            active: sideMenuOpen,
            onClick: () => setSideMenuOpen(true)
          }
        ]
      : workflowStep === "room"
        ? [
          {
              key: "menu",
              label: "메뉴",
              active: sideMenuOpen,
              onClick: () => setSideMenuOpen(true)
            },
            {
              key: "reset",
              label: "초기화",
              onClick: resetCurrentLayout
            }
          ]
        : workflowStep === "review"
          ? [
              {
                key: "menu",
                label: "메뉴",
                active: sideMenuOpen,
                onClick: () => setSideMenuOpen(true)
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
          : workflowStep === "openings"
            ? [
                {
                  key: "menu",
                  label: "메뉴",
                  active: sideMenuOpen,
                  onClick: () => setSideMenuOpen(true)
                },
                {
                  key: "select",
                  label: "이동",
                  active: editorMode === "select",
                  onClick: () => {
                    setEditorMode("select");
                    setBottomSheetMode(null);
                  }
                },
                {
                  key: "confirm",
                  label: "확정",
                  onClick: confirmOpeningsStep
                }
              ]
            : workflowStep === "furniture"
              ? [
                  {
                    key: "menu",
                    label: "메뉴",
                    active: sideMenuOpen,
                    onClick: () => setSideMenuOpen(true)
                  },
                  {
                    key: "select",
                    label: "이동",
                    active: editorMode === "select",
                    onClick: () => {
                      setEditorMode("select");
                      setBottomSheetMode(null);
                    }
                  },
                  {
                    key: "confirm",
                    label: "확정",
                    onClick: confirmFurnitureStep
                  },
                  ...(canEditElement
                    ? [
                        {
                          key: "edit",
                          label: "편집",
                          active: bottomSheetMode === "selection-actions",
                          onClick: () => setBottomSheetMode("selection-actions")
                        }
                      ]
                    : []),
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
                ]
          : [
              {
                key: "menu",
                label: "메뉴",
                active: sideMenuOpen,
                onClick: () => setSideMenuOpen(true)
              },
              {
                key: "select",
                label: "이동",
                active: editorMode === "select",
                onClick: () => {
                  setEditorMode("select");
                  setBottomSheetMode(null);
                }
              },
              ...(canEditElement
                ? [
                    {
                      key: "edit",
                      label: "편집",
                      active: bottomSheetMode === "selection-actions",
                      onClick: () => setBottomSheetMode("selection-actions")
                    }
                  ]
                : []),
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
    setSelectedElementId(undefined);
    setBottomSheetMode("object-picker");
    setNotice(`${catalogItems.find((item) => item.kind === kind)?.label ?? "요소"}를 추가했습니다. 계속 배치할 수 있습니다.`);
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
    <div className={isDarkMode ? "app-shell app-shell--dark" : "app-shell"}>
      <StepHeader
        currentStep={workflowStep}
        currentHint={currentHint}
        selectedSpaceLabel={selectedSpaceType?.label}
        serverStatusLabel={serverStatusInfo.label}
        serverStatusTone={serverStatusInfo.tone}
        onToggleTheme={() => {
          setIsDarkMode((current) => {
            const next = !current;
            setNotice(next ? "다크모드로 전환했습니다." : "기본 화면으로 전환했습니다.");
            return next;
          });
        }}
        onChangeSpace={() => {
          setWorkflowStep("space");
          setBottomSheetMode(null);
          setSideMenuOpen(true);
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
              <button className="primary-button" onClick={() => setSideMenuOpen(true)} type="button">
                공간 유형 고르기
              </button>
            </div>
          ) : null}

          {workflowStep === "room" ? (
            <div className="room-start-card room-start-card--compact">
              <div className="room-start-card__copy">
                <strong>도면 설정은 왼쪽 메뉴에서 진행합니다.</strong>
                <p>기본 사각형, 치수 입력, 고급 벽 수정은 메뉴에서 열어 필요한 항목만 조정하세요.</p>
              </div>
              <button className="primary-button" onClick={() => setSideMenuOpen(true)} type="button">
                도면 메뉴 열기
              </button>
            </div>
          ) : null}

          {workflowStep === "review" ? (
            <div className="review-status-card">
              {isAnalysisCurrent && reviewSummary ? (
                <>
              <div className="review-status-card__metrics">
                <div>
                  <span>검토 점수</span>
                  <strong>{reviewSummary.score}점</strong>
                </div>
                    <div>
                      <span>이슈 수</span>
                  <strong>{reviewSummary.issues.length}건</strong>
                </div>
              </div>
              {reviewSummary.subscores ? (
                <div className="review-status-card__subscores">
                  {typeof reviewSummary.subscores.pathway === "number" ? <span>통로 {reviewSummary.subscores.pathway}</span> : null}
                  {typeof reviewSummary.subscores.access === "number" ? <span>접근 {reviewSummary.subscores.access}</span> : null}
                  {typeof reviewSummary.subscores.density === "number" ? <span>밀집 {reviewSummary.subscores.density}</span> : null}
                  {typeof reviewSummary.subscores.alignment === "number" ? <span>정렬 {reviewSummary.subscores.alignment}</span> : null}
                </div>
              ) : null}
              <p>{reviewSummary.summary}</p>
            </>
              ) : analysisStatus === "loading" ? (
                <>
                  <strong>GUI 서버에서 배치를 분석하고 있습니다.</strong>
                  <p>현재 도면은 그대로 유지되며, 완료되면 문제 구역과 요약이 표시됩니다.</p>
                </>
              ) : serverStatus !== "connected" ? (
                <>
                  <strong>검토 전에 GUI 서버 연결이 필요합니다.</strong>
                  <p>Windows GUI에서 표시된 주소를 메뉴에 입력한 뒤 연결 확인을 눌러주세요.</p>
                </>
              ) : analysisResult ? (
                <>
                  <strong>배치가 변경되어 이전 분석 결과가 오래되었습니다.</strong>
                  <p>하단의 분석 버튼을 다시 눌러 최신 검토 결과를 받아오세요.</p>
                </>
              ) : (
                <>
                  <strong>서버 분석을 아직 실행하지 않았습니다.</strong>
                  <p>하단의 분석 버튼을 누르면 현재 배치 JSON을 GUI 서버에 보내 검토 결과를 받아옵니다.</p>
                </>
              )}
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
            analysisResult={reviewSummary}
            showAnalysisOverlay={workflowStep === "review" && isAnalysisCurrent}
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
          if (workflowStep === "openings" || workflowStep === "furniture") {
            setBottomSheetMode("object-picker");
            return;
          }

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

      <SideMenu
        open={sideMenuOpen}
        title={workflowStep === "room" ? "도면 메뉴" : workflowStep === "space" ? "공간 메뉴" : "작업 메뉴"}
        subtitle={
          workflowStep === "room"
            ? "도면 설정은 이 메뉴에서만 조정하도록 분리했습니다."
            : workflowStep === "space"
              ? "공간 유형을 다시 고르거나 초기화할 수 있습니다."
              : "배치 작업과 초기화를 한곳에서 다룹니다."
        }
        onClose={() => setSideMenuOpen(false)}
      >
        {workflowStep === "space" ? (
          <div className="sheet-option-grid">
            {spaceTypeOptions.map((option) => (
              <button key={option.id} className="sheet-option-card" onClick={() => chooseSpaceType(option)} type="button">
                <strong>{option.label}</strong>
                <p>{option.description}</p>
              </button>
            ))}
          </div>
        ) : null}

        {workflowStep === "room" ? (
          <>
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
              <span className="sheet-section__label">기본 도형</span>
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
              <p className="sheet-section__helper">직접 선을 그리는 대신 기본 도형을 먼저 적용하고, 정말 필요한 경우에만 사용하세요.</p>
              <div className="sheet-inline-grid">
                <button
                  className={roomDrawTool === "line" ? "sheet-chip sheet-chip--active" : "sheet-chip"}
                  onClick={() => {
                    setRoomDrawTool("line");
                    setEditorMode("draw-room");
                    setSideMenuOpen(false);
                    setNotice("직선 벽 모드입니다. 시작점을 누르고 벽을 한 줄씩 이어가세요.");
                  }}
                  type="button"
                >
                  직선 벽
                </button>
                <button
                  className={roomDrawTool === "arc" ? "sheet-chip sheet-chip--active" : "sheet-chip"}
                  onClick={() => {
                    setRoomDrawTool("arc");
                    setEditorMode("draw-room");
                    setSideMenuOpen(false);
                    setNotice("곡선 벽 모드입니다. 시작점을 누르고 곡선을 이어가세요.");
                  }}
                  type="button"
                >
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
          </>
        ) : null}

        {(workflowStep === "openings" || workflowStep === "furniture" || workflowStep === "review") ? (
          <div className="sheet-section">
            <span className="sheet-section__label">작업</span>
            <div className="sheet-inline-grid">
              <button className="sheet-chip" onClick={() => openSheetForCurrentStep()} type="button">
                {workflowStep === "review" ? "결과 보기" : "요소 추가"}
              </button>
              <button
                className="sheet-chip"
                onClick={() => {
                  setEditorMode("select");
                  setBottomSheetMode(null);
                  setSideMenuOpen(false);
                }}
                type="button"
              >
                이동 모드
              </button>
            </div>
          </div>
        ) : null}

        <div className="sheet-section">
          <span className="sheet-section__label">GUI 서버 연결</span>
          <p className="sheet-section__helper">Windows GUI에서 표시된 주소를 그대로 입력하세요. 예: http://192.168.0.10:8000</p>
          <label className="server-connection-field">
            서버 주소
            <input
              placeholder="http://192.168.0.10:8000"
              type="text"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(normalizeApiBaseUrl(event.target.value))}
            />
          </label>
          <div className="sheet-inline-grid">
            <button className="sheet-chip" onClick={() => void checkServerConnection()} type="button">
              연결 확인
            </button>
            {workflowStep === "review" ? (
              <button
                className="sheet-chip"
                disabled={analysisStatus === "loading" || serverStatus !== "connected"}
                onClick={() => void runServerAnalysis()}
                type="button"
              >
                분석 실행
              </button>
            ) : null}
          </div>
          <div className={`server-status-badge server-status-badge--${serverStatusInfo.tone}`}>{serverStatusInfo.label}</div>
          {serverError ? <p className="sheet-section__helper">{serverError}</p> : null}
          {analysisError && workflowStep === "review" ? <p className="sheet-section__helper">{analysisError}</p> : null}
        </div>

        <div className="sheet-section">
          <span className="sheet-section__label">공통</span>
          <div className="sheet-inline-grid">
            <button className="sheet-chip" onClick={resetCurrentLayout} type="button">
              초기화
            </button>
            <button
              className="sheet-chip"
              onClick={() => {
                setWorkflowStep("space");
                setBottomSheetMode("space-type");
                setSideMenuOpen(false);
              }}
              type="button"
            >
              공간 다시 선택
            </button>
          </div>
        </div>
      </SideMenu>

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
        subtitle="GUI 서버가 반환한 점수, 문제 구역, 제안을 그대로 보여줍니다."
        onClose={() => setBottomSheetMode(null)}
      >
        <div className="review-summary">
          {serverStatus !== "connected" ? (
            <div className="review-item review-item--warning">
              <strong>GUI 서버 연결이 필요합니다.</strong>
              <p>메뉴에서 Windows GUI가 표시한 주소를 입력한 뒤 연결 확인을 먼저 진행해주세요.</p>
            </div>
          ) : analysisStatus === "loading" ? (
            <div className="review-item">
              <strong>분석을 진행 중입니다.</strong>
              <p>현재 배치를 서버에 보내 점수와 문제 구역을 계산하고 있습니다.</p>
            </div>
          ) : isAnalysisCurrent && reviewSummary ? (
            <>
              <div className="review-summary__hero">
                <div>
                  <span>검토 점수</span>
                  <strong>{reviewSummary.score}점</strong>
                </div>
                <div>
                  <span>문제 구역</span>
                  <strong>{reviewSummary.issues.length}건</strong>
                </div>
              </div>

              {reviewSummary.subscores ? (
                <section className="sheet-section">
                  <span className="sheet-section__label">세부 점수</span>
                  <div className="review-summary__subscores">
                    {typeof reviewSummary.subscores.pathway === "number" ? <div className="review-summary__subscore"><span>통로</span><strong>{reviewSummary.subscores.pathway}</strong></div> : null}
                    {typeof reviewSummary.subscores.access === "number" ? <div className="review-summary__subscore"><span>접근</span><strong>{reviewSummary.subscores.access}</strong></div> : null}
                    {typeof reviewSummary.subscores.density === "number" ? <div className="review-summary__subscore"><span>밀집</span><strong>{reviewSummary.subscores.density}</strong></div> : null}
                    {typeof reviewSummary.subscores.alignment === "number" ? <div className="review-summary__subscore"><span>정렬</span><strong>{reviewSummary.subscores.alignment}</strong></div> : null}
                  </div>
                </section>
              ) : null}

              <p className="review-summary__text">{reviewSummary.summary}</p>

              <section className="sheet-section">
                <span className="sheet-section__label">주요 이슈</span>
                <div className="review-list">
                  {reviewSummary.issues.length === 0 ? (
                    <div className="review-item review-item--safe">
                      <strong>표시할 이슈가 없습니다.</strong>
                      <p>현재 서버 분석 결과 기준으로 강조할 문제 구역이 없습니다.</p>
                    </div>
                  ) : (
                    reviewSummary.issues.slice(0, 3).map((issue) => (
                      <div
                        key={issue.id}
                        className={
                          issue.severity === "high" || issue.severity === "critical" || issue.severity === "error"
                            ? "review-item review-item--danger"
                            : issue.severity === "medium" || issue.severity === "major" || issue.severity === "warning"
                              ? "review-item review-item--warning"
                              : "review-item review-item--safe"
                        }
                      >
                        <strong>{issue.title || issue.message}</strong>
                        <p>{issue.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="sheet-section">
                <span className="sheet-section__label">개선 제안</span>
                <div className="review-list">
                  {reviewSummary.suggestions.length === 0 ? (
                    <div className="review-item">
                      <strong>제안이 없습니다.</strong>
                      <p>이번 응답에는 추가 개선 제안이 포함되지 않았습니다.</p>
                    </div>
                  ) : (
                    reviewSummary.suggestions.slice(0, 3).map((suggestion, index) => (
                      <div key={`${suggestion}-${index}`} className="review-item">
                        <strong>제안 {index + 1}</strong>
                        <p>{suggestion}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : analysisError ? (
            <div className="review-item review-item--danger">
              <strong>분석 요청에 실패했습니다.</strong>
              <p>{analysisError}</p>
            </div>
          ) : (
            <div className="review-item">
              <strong>최신 검토 결과가 없습니다.</strong>
              <p>하단의 분석 버튼을 눌러 현재 배치 JSON을 GUI 서버에 전송하세요.</p>
            </div>
          )}
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
