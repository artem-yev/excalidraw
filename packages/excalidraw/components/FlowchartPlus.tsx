import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type { LinkDirection } from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import "./FlowchartPlus.scss";

import type { AppState } from "../types";

const DIRECTIONS = ["up", "right", "down", "left"] as const;
const GAP = 24;

export const FlowchartPlus = ({
  element,
  appState,
  onCreate,
}: {
  element: NonDeletedExcalidrawElement;
  appState: AppState;
  onCreate: (direction: LinkDirection) => void;
}) => {
  if (
    element.locked ||
    (element.type !== "rectangle" && element.type !== "diamond") ||
    appState.activeTool.type !== "selection" ||
    appState.viewModeEnabled ||
    appState.zenModeEnabled ||
    appState.contextMenu ||
    appState.openMenu ||
    appState.openDialog ||
    appState.editingTextElement ||
    appState.editingGroupId ||
    appState.newElement ||
    appState.resizingElement ||
    appState.isRotating ||
    appState.selectedElementsAreBeingDragged
  ) {
    return null;
  }

  // Axis-aligned extents of the rotated shape keep the buttons outside its
  // outline, while the engine's direction remains a canvas cardinal direction.
  const cos = Math.abs(Math.cos(element.angle));
  const sin = Math.abs(Math.sin(element.angle));
  const halfWidth = (element.width * cos + element.height * sin) / 2;
  const halfHeight = (element.width * sin + element.height * cos) / 2;
  const center = sceneCoordsToViewportCoords(
    {
      sceneX: element.x + element.width / 2,
      sceneY: element.y + element.height / 2,
    },
    appState,
  );
  const x = center.x - appState.offsetLeft;
  const y = center.y - appState.offsetTop;
  const offsets = {
    up: [0, -halfHeight * appState.zoom.value - GAP],
    right: [halfWidth * appState.zoom.value + GAP, 0],
    down: [0, halfHeight * appState.zoom.value + GAP],
    left: [-halfWidth * appState.zoom.value - GAP, 0],
  };

  return (
    <div
      className="flowchart-plus"
      role="group"
      aria-label="Add flowchart step"
    >
      {DIRECTIONS.map((direction) => (
        <button
          key={direction}
          type="button"
          className="flowchart-plus__button"
          aria-label={`Add connected shape ${direction}`}
          title={`Add connected shape ${direction}`}
          style={{
            left: x + offsets[direction][0],
            top: y + offsets[direction][1],
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onCreate(direction);
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      ))}
    </div>
  );
};
