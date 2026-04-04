import { LayoutElement, ObjectKind } from "../types/layout";

export interface CatalogItem {
  kind: ObjectKind;
  label: string;
  width: number;
  height: number;
  volumeHeight: number;
  color: string;
  category: LayoutElement["category"];
  metadata?: Record<string, string | number | boolean>;
}

export const catalogItems: CatalogItem[] = [
  {
    kind: "bed",
    label: "침상",
    width: 210,
    height: 100,
    volumeHeight: 75,
    color: "#4c6ef5",
    category: "furniture"
  },
  {
    kind: "locker",
    label: "관물대",
    width: 90,
    height: 60,
    volumeHeight: 190,
    color: "#5c7cfa",
    category: "furniture"
  },
  {
    kind: "desk",
    label: "책상",
    width: 120,
    height: 60,
    volumeHeight: 75,
    color: "#228be6",
    category: "furniture"
  },
  {
    kind: "chair",
    label: "의자",
    width: 50,
    height: 50,
    volumeHeight: 85,
    color: "#339af0",
    category: "furniture"
  },
  {
    kind: "storage",
    label: "보관함",
    width: 120,
    height: 80,
    volumeHeight: 120,
    color: "#12b886",
    category: "furniture"
  },
  {
    kind: "equipment",
    label: "장비함",
    width: 140,
    height: 80,
    volumeHeight: 160,
    color: "#2f9e44",
    category: "furniture"
  },
  {
    kind: "door",
    label: "문",
    width: 100,
    height: 20,
    volumeHeight: 210,
    color: "#f08c00",
    category: "opening",
    metadata: {
      openingDirection: "inward-left",
      swingDepth: 100,
      isEmergencyExit: true
    }
  },
  {
    kind: "window",
    label: "창문",
    width: 140,
    height: 20,
    volumeHeight: 150,
    color: "#15aabf",
    category: "opening"
  },
  {
    kind: "pillar",
    label: "기둥",
    width: 40,
    height: 40,
    volumeHeight: 240,
    color: "#868e96",
    category: "structure",
    metadata: {
      fixed: true
    }
  }
];
