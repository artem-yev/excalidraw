import { KEYS, reseed } from "@excalidraw/common";
import { Excalidraw } from "@excalidraw/excalidraw";
import {
  CaptureUpdateAction,
  isFlowchartNodeElement,
} from "@excalidraw/element";

import { getFlowchartDragPosition } from "../components/FlowchartDragHandles";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

const { h } = window;
unmountComponent();

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally />);
});

const selectNode = (type: "rectangle" | "diamond" = "rectangle") => {
  const node = API.createElement({
    type,
    x: 100,
    y: 100,
    width: 160,
    height: 80,
    backgroundColor: "#a5d8ff",
    strokeColor: "#1971c2",
    strokeWidth: 2,
    fillStyle: "solid",
  });
  API.setElements([node]);
  API.setSelectedElements([node]);
  if (!isFlowchartNodeElement(node)) {
    throw new Error("Expected a flowchart node");
  }
  return node;
};

it.each(["rectangle", "diamond"] as const)(
  "previews %s without changing scene elements or source bindings; cancel is clean",
  (type) => {
    const node = selectNode(type);
    const before = JSON.stringify(node);
    const historySize = API.getUndoStack().length;
    act(() => {
      h.app.flowchart.previewDrag(node, "right", { x: 420, y: 240 });
      h.app.flowchart.previewDrag(node, "right", { x: 510, y: 300 });
    });
    expect(h.elements).toHaveLength(1);
    expect(JSON.stringify(node)).toBe(before);
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    act(() => h.app.flowchart.cancelDrag());
    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(JSON.stringify(node)).toBe(before);
    expect(API.getUndoStack()).toHaveLength(historySize);
  },
);

it.each(["rectangle", "diamond"] as const)(
  "commits styled %s with reciprocal bindings, selected successor and one undo/redo",
  (type) => {
    const node = selectNode(type);
    act(() => {
      h.app.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    act(() => h.app.flowchart.commitDrag(node, "down", { x: 320, y: 380 }));
    expect(h.elements).toHaveLength(3);
    const successor = h.elements.find(
      (element) => element.type === type && element.id !== node.id,
    )!;
    const arrow = h.elements.find((element) => element.type === "arrow")!;
    expect(successor).toMatchObject({
      x: 320,
      y: 380,
      width: node.width,
      height: node.height,
      strokeColor: node.strokeColor,
      backgroundColor: node.backgroundColor,
      strokeWidth: node.strokeWidth,
      fillStyle: node.fillStyle,
    });
    expect(arrow).toMatchObject({
      elbowed: true,
      startBinding: { elementId: node.id },
      endBinding: { elementId: successor.id },
    });
    expect(node.boundElements).toContainEqual({ id: arrow.id, type: "arrow" });
    expect(successor.boundElements).toContainEqual({
      id: arrow.id,
      type: "arrow",
    });
    expect(h.state.selectedElementIds[successor.id]).toBe(true);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress("z"));
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
    expect(h.elements[0].boundElements).not.toContainEqual({
      id: arrow.id,
      type: "arrow",
    });
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () =>
      Keyboard.keyPress("z"),
    );
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
  },
);

it("keeps dragged nodes beyond the chosen edge in all four directions", () => {
  const node = selectNode();
  const point = { x: 180, y: 140 };
  expect(getFlowchartDragPosition(node, "right", point).x).toBe(300);
  expect(getFlowchartDragPosition(node, "left", point).x).toBe(-100);
  expect(getFlowchartDragPosition(node, "down", point).y).toBe(220);
  expect(getFlowchartDragPosition(node, "up", point).y).toBe(-20);
  // Rotated source bounds can extend beyond its original x/y/width/height.
  expect(
    getFlowchartDragPosition(node, "down", point, [100, 60, 260, 220]).y,
  ).toBe(260);
});

it("shows handles only for one editable rectangle or diamond in selection mode", () => {
  const node = selectNode();
  expect(document.querySelectorAll(".flowchart-drag-handle")).toHaveLength(4);
  const ellipse = API.createElement({ type: "ellipse" });
  API.setElements([node, ellipse]);
  API.setSelectedElements([node, ellipse]);
  expect(document.querySelectorAll(".flowchart-drag-handle")).toHaveLength(0);
  API.setSelectedElements([ellipse]);
  expect(document.querySelectorAll(".flowchart-drag-handle")).toHaveLength(0);
  API.setSelectedElements([node]);
  API.setAppState({ viewModeEnabled: true });
  expect(document.querySelectorAll(".flowchart-drag-handle")).toHaveLength(0);
  API.setAppState({
    viewModeEnabled: false,
    activeTool: { ...h.state.activeTool, type: "hand", customType: null },
  });
  expect(document.querySelectorAll(".flowchart-drag-handle")).toHaveLength(0);
});

it.each(["Escape", "pointercancel", "lostpointercapture"] as const)(
  "%s cancels a captured pointer without leaving elements or bindings",
  (cancel) => {
    const node = selectNode();
    const before = JSON.stringify(node);
    const handle = document.querySelector<HTMLButtonElement>(
      '[aria-label="Drag to create connected shape right"]',
    )!;
    Object.defineProperties(handle, {
      setPointerCapture: { value: vi.fn(), configurable: true },
      releasePointerCapture: { value: vi.fn(), configurable: true },
      hasPointerCapture: { value: vi.fn(() => true), configurable: true },
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      isPrimary: true,
      clientX: 284,
      clientY: 140,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 520,
      clientY: 240,
    });
    expect(h.app.flowchart.pendingNodes).toHaveLength(2);
    if (cancel === "Escape") {
      fireEvent.keyDown(window, { key: KEYS.ESCAPE });
    } else if (cancel === "pointercancel") {
      fireEvent.pointerCancel(handle, { pointerId: 1 });
    } else {
      fireEvent.lostPointerCapture(handle, { pointerId: 1 });
    }
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(h.app.flowchart.pendingNodes).toBeNull();
    expect(h.elements).toHaveLength(1);
    expect(JSON.stringify(node)).toBe(before);
  },
);
