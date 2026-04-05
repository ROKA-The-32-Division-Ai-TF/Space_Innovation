import { AnalyzeRequest } from "../types/analyze";
import { SpaceLayout } from "../types/layout";

export const buildAnalyzeRequest = (layout: SpaceLayout, spaceType?: string): AnalyzeRequest => ({
  space_type: spaceType ?? layout.layoutCategory ?? layout.room.name,
  layout_id: layout.id,
  unit: "cm",
  room: {
    width: layout.room.width,
    height: layout.room.height,
    outline: layout.room.outline,
    boundary_segments: layout.room.boundarySegments
  },
  objects: layout.elements.map((element) => ({
    id: element.id,
    name: element.name,
    type: element.kind,
    category: element.category,
    x: element.x,
    y: element.y,
    w: element.width,
    h: element.height,
    rotation: element.rotation,
    metadata: element.metadata
  }))
});
