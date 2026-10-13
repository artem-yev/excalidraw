import { useEffect, useRef } from "react";

import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { getElementBounds } from "@excalidraw/element";

import type { LinkDirection } from "@excalidraw/element";
import type {
  ExcalidrawFlowchartNodeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import "./FlowchartDragHandles.scss";

import type App from "./App";

type Node = NonDeleted<ExcalidrawFlowchartNodeElement>;
type Drag = {
  pointerId: number;
  handle: HTMLButtonElement;
  startX: number;
  startY: number;
  position: { x: number; y: number } | null;
};

/** Keep the new shape beyond the chosen edge while allowing cross-axis placement. */
export const getFlowchartDragPosition = (
  node: Node,
  direction: LinkDirection,
  point: { x: number; y: number },
  bounds: readonly [number, number, number, number] = [
    node.x,
    node.y,
    node.x + node.width,
    node.y + node.height,
  ],
) => {
  const position = {
    x: point.x - node.width / 2,
    y: point.y - node.height / 2,
  };
  const gap = 40;
  switch (direction) {
    case "right":
      position.x = Math.max(position.x, bounds[2] + gap);
      break;
    case "left":
      position.x = Math.min(position.x, bounds[0] - node.width - gap);
      break;
    case "down":
      position.y = Math.max(position.y, bounds[3] + gap);
      break;
    case "up":
      position.y = Math.min(position.y, bounds[1] - node.height - gap);
      break;
  }
  return position;
};

export const FlowchartDragHandles = ({ app }: { app: App }) => {
  const drag = useRef<Drag | null>(null);
  const state = app.state;
  const selected = app.scene.getSelectedElements(state);
  const element = selected.length === 1 ? selected[0] : null;
  const node =
    element &&
    (element.type === "rectangle" || element.type === "diamond") &&
    !element.locked &&
    !element.groupIds.length &&
    state.activeTool.type === "selection" &&
    !state.viewModeEnabled &&
    !state.editingTextElement &&
    !state.selectedElementsAreBeingDragged &&
    !state.resizingElement &&
    !state.isRotating &&
    !app.flowchart.isCreatingChart &&
    !state.openDialog &&
    !state.openMenu
      ? element
      : null;

  useEffect(() => {
    const cancel = () => {
      const active = drag.current;
      drag.current = null;
      if (active) {
        app.flowchart.cancelDrag();
        if (active.handle.hasPointerCapture?.(active.pointerId)) {
          active.handle.releasePointerCapture(active.pointerId);
        }
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    app.ownerWindow.addEventListener("keydown", escape, true);
    app.ownerWindow.addEventListener("blur", cancel);
    return () => {
      app.ownerWindow.removeEventListener("keydown", escape, true);
      app.ownerWindow.removeEventListener("blur", cancel);
      cancel();
    };
  }, [app, node?.id]);

  if (!node) {
    return null;
  }

  const [left, top, right, bottom] = getElementBounds(
    node,
    app.scene.getNonDeletedElementsMap(),
  );
  const handles = [
    {
      direction: "up",
      x: (left + right) / 2,
      y: top,
      dx: 0,
      dy: -24,
      icon: "↑",
    },
    {
      direction: "right",
      x: right,
      y: (top + bottom) / 2,
      dx: 24,
      dy: 0,
      icon: "→",
    },
    {
      direction: "down",
      x: (left + right) / 2,
      y: bottom,
      dx: 0,
      dy: 24,
      icon: "↓",
    },
    {
      direction: "left",
      x: left,
      y: (top + bottom) / 2,
      dx: -24,
      dy: 0,
      icon: "←",
    },
  ] as const;

  return (
    <div className="flowchart-drag-handles">
      {handles.map(({ direction, x, y, dx, dy, icon }) => {
        const point = sceneCoordsToViewportCoords(
          { sceneX: x, sceneY: y },
          state,
        );
        return (
          <button
            key={direction}
            type="button"
            className="flowchart-drag-handle"
            aria-label={`Drag to create connected shape ${direction}`}
            title={`Drag ${direction} to create a connected shape · Esc to cancel`}
            style={{
              left: point.x - state.offsetLeft + dx,
              top: point.y - state.offsetTop + dy,
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary || drag.current) {
                return;
              }
              event.stopPropagation();
              event.preventDefault();
              app.flowchart.clear();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                handle: event.currentTarget,
                startX: event.clientX,
                startY: event.clientY,
                position: null,
              };
            }}
            onPointerMove={(event) => {
              const active = drag.current;
              if (!active || active.pointerId !== event.pointerId) {
                return;
              }
              event.stopPropagation();
              if (
                !active.position &&
                Math.hypot(
                  event.clientX - active.startX,
                  event.clientY - active.startY,
                ) < 8
              ) {
                return;
              }
              active.position = getFlowchartDragPosition(
                node,
                direction,
                viewportCoordsToSceneCoords(event, app.state),
                [left, top, right, bottom],
              );
              app.flowchart.previewDrag(node, direction, active.position);
            }}
            onPointerUp={(event) => {
              const active = drag.current;
              if (!active || active.pointerId !== event.pointerId) {
                return;
              }
              event.stopPropagation();
              drag.current = null;
              if (active.position) {
                app.flowchart.commitDrag(node, direction, active.position);
              } else {
                app.flowchart.cancelDrag();
              }
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              if (drag.current?.pointerId === event.pointerId) {
                drag.current = null;
                app.flowchart.cancelDrag();
              }
            }}
            onLostPointerCapture={() => {
              if (drag.current) {
                drag.current = null;
                app.flowchart.cancelDrag();
              }
            }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
};
