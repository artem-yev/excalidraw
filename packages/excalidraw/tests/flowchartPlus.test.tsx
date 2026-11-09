import { KEYS, reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render, fireEvent, screen, unmountComponent } from "./test-utils";

unmountComponent();
const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  API.setAppState({ width: 1000, height: 1000 });
});

const selectNode = (type: "rectangle" | "diamond" = "rectangle") => {
  const node = API.createElement({
    type,
    x: 300,
    y: 300,
    width: 160,
    height: 100,
    strokeColor: "#1971c2",
    backgroundColor: "#a5d8ff",
    strokeWidth: 2,
  });
  API.updateScene({
    elements: [node],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  API.setSelectedElements([node]);
  return node;
};

it.each(["up", "right", "down", "left"] as const)(
  "creates a styled, bound successor %s and selects it",
  (direction) => {
    const source = selectNode();
    expect(
      screen.getAllByRole("button", { name: /Add connected shape/ }),
    ).toHaveLength(4);
    fireEvent.click(
      screen.getByRole("button", { name: `Add connected shape ${direction}` }),
    );
    const node = API.getSelectedElements()[0];
    expect(node.id).not.toBe(source.id);
    expect(node.type).toBe("rectangle");
    expect(node.strokeColor).toBe(source.strokeColor);
    expect(node.backgroundColor).toBe(source.backgroundColor);
    expect(node.strokeWidth).toBe(source.strokeWidth);
    const arrow = h.elements.find((element) => element.type === "arrow");
    expect(arrow?.type === "arrow" && arrow.startBinding?.elementId).toBe(
      source.id,
    );
    expect(arrow?.type === "arrow" && arrow.endBinding?.elementId).toBe(
      node.id,
    );
    if (direction === "right") {
      expect(node.x).toBeGreaterThan(source.x + source.width);
    }
    if (direction === "left") {
      expect(node.x + node.width).toBeLessThan(source.x);
    }
    if (direction === "down") {
      expect(node.y).toBeGreaterThan(source.y + source.height);
    }
    if (direction === "up") {
      expect(node.y + node.height).toBeLessThan(source.y);
    }
  },
);

it("supports diamonds and removes each click in one undo transaction", async () => {
  selectNode("diamond");
  fireEvent.click(
    screen.getByRole("button", { name: "Add connected shape right" }),
  );
  expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
  expect(API.getSelectedElements()[0].type).toBe("diamond");
  Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.Z));
  expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () =>
    Keyboard.keyPress(KEYS.Z),
  );
  expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
});

it("positions fixed-size controls correctly under zoom, pan and editor offsets", () => {
  selectNode();
  API.setAppState({
    zoom: { value: 2 as any },
    scrollX: -100,
    scrollY: 50,
    offsetLeft: 60,
    offsetTop: 40,
  });
  const button = screen.getByRole("button", {
    name: "Add connected shape right",
  });
  expect(button.style.left).toBe("744px");
  expect(button.style.top).toBe("800px");
});

it("hides controls for multiselection, non-flowchart shapes, editing and irrelevant modes", () => {
  const node = selectNode();
  const other = API.createElement({ type: "ellipse" });
  API.setElements([node, other]);
  API.setSelectedElements([node, other]);
  expect(
    screen.queryByRole("group", { name: "Add flowchart step" }),
  ).toBeNull();
  API.setSelectedElements([other]);
  expect(
    screen.queryByRole("group", { name: "Add flowchart step" }),
  ).toBeNull();
  API.setSelectedElements([node]);
  for (const state of [
    { viewModeEnabled: true },
    { zenModeEnabled: true },
    { selectedElementsAreBeingDragged: true },
    { activeTool: { type: "hand" } },
  ] as const) {
    API.setAppState(state as any);
    expect(
      screen.queryByRole("group", { name: "Add flowchart step" }),
    ).toBeNull();
    API.setAppState({
      viewModeEnabled: false,
      zenModeEnabled: false,
      selectedElementsAreBeingDragged: false,
      activeTool: {
        type: "selection",
        customType: null,
        locked: false,
        lastActiveTool: null,
        fromSelection: false,
      },
    });
  }
  API.updateElement(node, { locked: true });
  expect(
    screen.queryByRole("group", { name: "Add flowchart step" }),
  ).toBeNull();
});
