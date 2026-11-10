import { useState } from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type { LinkDirection } from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import "./FlowchartAddStep.scss";

import type { AppState } from "../types";

export const canShowFlowchartAddStep = (
  elements: readonly NonDeletedExcalidrawElement[],
  state: AppState,
) =>
  elements.length === 1 &&
  (elements[0].type === "rectangle" || elements[0].type === "diamond") &&
  state.activeTool.type === "selection" &&
  !state.viewModeEnabled &&
  !state.zenModeEnabled &&
  !state.editingTextElement &&
  !state.editingGroupId &&
  !state.selectedElementsAreBeingDragged &&
  !state.newElement &&
  !state.selectionElement &&
  !state.resizingElement &&
  !state.isRotating &&
  !state.contextMenu &&
  !state.openMenu &&
  !state.openDialog;

const directions: { direction: LinkDirection; icon: string }[] = [
  { direction: "up", icon: "↑" },
  { direction: "right", icon: "→" },
  { direction: "down", icon: "↓" },
  { direction: "left", icon: "←" },
];

export const FlowchartAddStep = ({
  element,
  appState,
  onAdd,
}: {
  element: NonDeletedExcalidrawElement;
  appState: AppState;
  onAdd: (direction: LinkDirection) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [x1, , x2, y2] = getCommonBounds([element]);
  const { x, y } = sceneCoordsToViewportCoords(
    { sceneX: (x1 + x2) / 2, sceneY: y2 },
    appState,
  );
  // Keep controls reachable at every zoom level, including edge selections.
  const width = 152;
  const height = expanded ? 116 : 36;
  const left = Math.max(
    8,
    Math.min(x - appState.offsetLeft - width / 2, appState.width - width - 8),
  );
  const top = Math.max(
    8,
    Math.min(y - appState.offsetTop + 14, appState.height - height - 8),
  );

  return (
    <div
      className="flowchart-add-step"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.stopPropagation();
          setExpanded(false);
          event.currentTarget.querySelector("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        className="flowchart-add-step__trigger"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span aria-hidden="true">+</span> {t("labels.flowchartAddStep")}
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      {expanded && (
        <div
          className="flowchart-add-step__directions"
          role="group"
          aria-label={t("labels.flowchartDirection")}
        >
          {directions.map(({ direction, icon }) => (
            <button
              key={direction}
              type="button"
              aria-label={t(`labels.flowchartAdd${direction}`)}
              title={t(`labels.flowchartAdd${direction}`)}
              onClick={() => {
                setExpanded(false);
                onAdd(direction);
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {t(`labels.flowchart${direction}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
