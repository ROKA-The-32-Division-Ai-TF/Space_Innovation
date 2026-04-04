import { createBoundarySegmentsFromOutline } from "../engine/geometry";
import { SpaceLayout } from "../types/layout";

const barracksOutline = [
  { x: 0, y: 0 },
  { x: 800, y: 0 },
  { x: 800, y: 600 },
  { x: 0, y: 600 }
];

export const sampleBarracksLayout: SpaceLayout = {
  id: "layout-barracks-alpha",
  name: "생활관 A안",
  description: "8인 생활관 기본 배치 예시",
  ruleSetId: "barracks-default",
  room: {
    id: "room-alpha",
    name: "생활관",
    width: 800,
    height: 600,
    outline: barracksOutline,
    boundarySegments: createBoundarySegmentsFromOutline(barracksOutline),
    wallHeight: 260
  },
  elements: [
    {
      id: "door-1",
      name: "정문",
      kind: "door",
      category: "opening",
      x: 330,
      y: 580,
      width: 100,
      height: 20,
      rotation: 0,
      locked: true,
      metadata: {
        openingDirection: "inward-left",
        swingDepth: 100,
        isEmergencyExit: true
      }
    },
    {
      id: "window-1",
      name: "좌측 창문",
      kind: "window",
      category: "opening",
      x: 60,
      y: 0,
      width: 160,
      height: 20,
      rotation: 0,
      locked: true
    },
    {
      id: "window-2",
      name: "우측 창문",
      kind: "window",
      category: "opening",
      x: 580,
      y: 0,
      width: 160,
      height: 20,
      rotation: 0,
      locked: true
    },
    {
      id: "pillar-1",
      name: "중앙 기둥",
      kind: "pillar",
      category: "structure",
      x: 380,
      y: 260,
      width: 40,
      height: 40,
      rotation: 0,
      locked: true,
      metadata: {
        fixed: true
      }
    },
    {
      id: "bed-1",
      name: "침상 1",
      kind: "bed",
      category: "furniture",
      x: 20,
      y: 40,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-2",
      name: "침상 2",
      kind: "bed",
      category: "furniture",
      x: 20,
      y: 160,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-3",
      name: "침상 3",
      kind: "bed",
      category: "furniture",
      x: 20,
      y: 280,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-4",
      name: "침상 4",
      kind: "bed",
      category: "furniture",
      x: 20,
      y: 400,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-5",
      name: "침상 5",
      kind: "bed",
      category: "furniture",
      x: 560,
      y: 40,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-6",
      name: "침상 6",
      kind: "bed",
      category: "furniture",
      x: 560,
      y: 160,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-7",
      name: "침상 7",
      kind: "bed",
      category: "furniture",
      x: 560,
      y: 280,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "bed-8",
      name: "침상 8",
      kind: "bed",
      category: "furniture",
      x: 560,
      y: 400,
      width: 210,
      height: 100,
      rotation: 0
    },
    {
      id: "locker-1",
      name: "관물대 1",
      kind: "locker",
      category: "furniture",
      x: 250,
      y: 40,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-2",
      name: "관물대 2",
      kind: "locker",
      category: "furniture",
      x: 250,
      y: 120,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-3",
      name: "관물대 3",
      kind: "locker",
      category: "furniture",
      x: 250,
      y: 200,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-4",
      name: "관물대 4",
      kind: "locker",
      category: "furniture",
      x: 250,
      y: 280,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-5",
      name: "관물대 5",
      kind: "locker",
      category: "furniture",
      x: 460,
      y: 40,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-6",
      name: "관물대 6",
      kind: "locker",
      category: "furniture",
      x: 460,
      y: 120,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-7",
      name: "관물대 7",
      kind: "locker",
      category: "furniture",
      x: 460,
      y: 200,
      width: 90,
      height: 60,
      rotation: 0
    },
    {
      id: "locker-8",
      name: "관물대 8",
      kind: "locker",
      category: "furniture",
      x: 360,
      y: 510,
      width: 90,
      height: 60,
      rotation: 0
    }
  ]
};

export const sampleOfficeLayout: SpaceLayout = {
  id: "layout-office-bravo",
  name: "사무실 B안",
  description: "중대 행정반 사무실 배치 예시",
  ruleSetId: "barracks-default",
  room: {
    id: "room-office",
    name: "행정 사무실",
    width: 900,
    height: 620,
    outline: [
      { x: 0, y: 0 },
      { x: 900, y: 0 },
      { x: 900, y: 320 },
      { x: 760, y: 320 },
      { x: 760, y: 620 },
      { x: 0, y: 620 }
    ],
    boundarySegments: createBoundarySegmentsFromOutline([
      { x: 0, y: 0 },
      { x: 900, y: 0 },
      { x: 900, y: 320 },
      { x: 760, y: 320 },
      { x: 760, y: 620 },
      { x: 0, y: 620 }
    ]),
    wallHeight: 250
  },
  elements: [
    {
      id: "office-door-1",
      name: "주출입문",
      kind: "door",
      category: "opening",
      x: 320,
      y: 600,
      width: 100,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: true,
      metadata: {
        openingDirection: "inward-right",
        swingDepth: 100
      }
    },
    {
      id: "office-window-1",
      name: "전면 창",
      kind: "window",
      category: "opening",
      x: 90,
      y: 0,
      width: 180,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: true
    },
    {
      id: "office-window-2",
      name: "측면 창",
      kind: "window",
      category: "opening",
      x: 520,
      y: 0,
      width: 180,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: true
    },
    {
      id: "office-desk-1",
      name: "행정 책상 1",
      kind: "desk",
      category: "furniture",
      x: 70,
      y: 80,
      width: 140,
      height: 70,
      rotation: 0,
      opacity: 1
    },
    {
      id: "office-chair-1",
      name: "행정 의자 1",
      kind: "chair",
      category: "furniture",
      x: 120,
      y: 165,
      width: 55,
      height: 55,
      rotation: 0,
      opacity: 1
    },
    {
      id: "office-desk-2",
      name: "행정 책상 2",
      kind: "desk",
      category: "furniture",
      x: 260,
      y: 80,
      width: 140,
      height: 70,
      rotation: 0,
      opacity: 1
    },
    {
      id: "office-chair-2",
      name: "행정 의자 2",
      kind: "chair",
      category: "furniture",
      x: 310,
      y: 165,
      width: 55,
      height: 55,
      rotation: 0,
      opacity: 1
    },
    {
      id: "office-desk-3",
      name: "상황 책상",
      kind: "desk",
      category: "furniture",
      x: 520,
      y: 100,
      width: 180,
      height: 80,
      rotation: 0,
      opacity: 1
    },
    {
      id: "office-chair-3",
      name: "상황 의자",
      kind: "chair",
      category: "furniture",
      x: 585,
      y: 195,
      width: 55,
      height: 55,
      rotation: 0,
      opacity: 1
    },
    {
      id: "office-locker-1",
      name: "서류함 1",
      kind: "locker",
      category: "furniture",
      x: 70,
      y: 300,
      width: 80,
      height: 120,
      rotation: 90,
      opacity: 1
    },
    {
      id: "office-locker-2",
      name: "서류함 2",
      kind: "locker",
      category: "furniture",
      x: 180,
      y: 300,
      width: 80,
      height: 120,
      rotation: 90,
      opacity: 1
    }
  ]
};

export const sampleStorageLayout: SpaceLayout = {
  id: "layout-storage-charlie",
  name: "창고 C안",
  description: "장비 보관 및 점검 통로 중심의 창고 예시",
  ruleSetId: "barracks-default",
  room: {
    id: "room-storage",
    name: "장비 창고",
    width: 980,
    height: 680,
    outline: [
      { x: 0, y: 0 },
      { x: 980, y: 0 },
      { x: 980, y: 520 },
      { x: 880, y: 520 },
      { x: 880, y: 680 },
      { x: 0, y: 680 }
    ],
    boundarySegments: createBoundarySegmentsFromOutline([
      { x: 0, y: 0 },
      { x: 980, y: 0 },
      { x: 980, y: 520 },
      { x: 880, y: 520 },
      { x: 880, y: 680 },
      { x: 0, y: 680 }
    ]),
    wallHeight: 300
  },
  elements: [
    {
      id: "storage-door-1",
      name: "창고문",
      kind: "door",
      category: "opening",
      x: 440,
      y: 660,
      width: 120,
      height: 20,
      rotation: 0,
      opacity: 1,
      locked: true,
      metadata: {
        openingDirection: "inward-left",
        swingDepth: 120
      }
    },
    {
      id: "storage-pillar-1",
      name: "기둥",
      kind: "pillar",
      category: "structure",
      x: 620,
      y: 300,
      width: 40,
      height: 40,
      rotation: 0,
      opacity: 1,
      locked: true
    },
    {
      id: "storage-equip-1",
      name: "장비함 A",
      kind: "equipment",
      category: "furniture",
      x: 40,
      y: 60,
      width: 180,
      height: 90,
      rotation: 0,
      opacity: 1
    },
    {
      id: "storage-equip-2",
      name: "장비함 B",
      kind: "equipment",
      category: "furniture",
      x: 40,
      y: 180,
      width: 180,
      height: 90,
      rotation: 0,
      opacity: 1
    },
    {
      id: "storage-store-1",
      name: "보관함 A",
      kind: "storage",
      category: "furniture",
      x: 760,
      y: 60,
      width: 150,
      height: 100,
      rotation: 0,
      opacity: 1
    },
    {
      id: "storage-store-2",
      name: "보관함 B",
      kind: "storage",
      category: "furniture",
      x: 760,
      y: 190,
      width: 150,
      height: 100,
      rotation: 0,
      opacity: 1
    },
    {
      id: "storage-store-3",
      name: "보관함 C",
      kind: "storage",
      category: "furniture",
      x: 760,
      y: 320,
      width: 150,
      height: 100,
      rotation: 0,
      opacity: 1
    }
  ]
};

export const createCustomTemplateLayout = (): SpaceLayout => ({
  id: `layout-custom-${Math.random().toString(36).slice(2, 7)}`,
  name: "사용자 정의",
  description: "비정형 공간을 직접 설계하는 사용자 정의 템플릿",
  ruleSetId: "barracks-default",
  room: {
    id: `room-custom-${Math.random().toString(36).slice(2, 7)}`,
    name: "신규 공간",
    width: 880,
    height: 640,
    outline: [
      { x: 0, y: 0 },
      { x: 880, y: 0 },
      { x: 880, y: 420 },
      { x: 760, y: 420 },
      { x: 760, y: 640 },
      { x: 0, y: 640 }
    ],
    boundarySegments: createBoundarySegmentsFromOutline([
      { x: 0, y: 0 },
      { x: 880, y: 0 },
      { x: 880, y: 420 },
      { x: 760, y: 420 },
      { x: 760, y: 640 },
      { x: 0, y: 640 }
    ]),
    wallHeight: 260
  },
  elements: []
});
