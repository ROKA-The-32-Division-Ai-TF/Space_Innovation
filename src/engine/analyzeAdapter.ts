import { AnalyzeRequest } from "../types/analyze";
import { SpaceLayout } from "../types/layout";

export const buildAnalyzeRequest = (layout: SpaceLayout, spaceType?: string): AnalyzeRequest => ({
  spaceType: spaceType ?? layout.layoutCategory ?? layout.room.name,
  layoutId: layout.id,
  unit: "cm",
  room: {
    width: layout.room.width,
    height: layout.room.height,
    outline: layout.room.outline,
    boundarySegments: layout.room.boundarySegments
  },
  elements: layout.elements.map((element) => ({
    id: element.id,
    name: element.name,
    kind: element.kind,
    category: element.category,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    metadata: element.metadata
  }))
});
