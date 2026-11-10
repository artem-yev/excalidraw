import { render as renderDOM, screen } from "@testing-library/react";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { FlowchartAddStep } from "../components/FlowchartAddStep";
import { getDefaultAppState } from "../appState";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;

beforeEach(async () => {
  localStorage.clear();
  await render(<Excalidraw handleKeyboardGlobally />);
  API.setAppState({ width: 1000, height: 800 });
});

const selectNode = (type: "rectangle" | "diamond" = "rectangle") => {
  const node = API.createElement({
    type,
    x: 300,
    y: 200,
    width: 120,
    height: 80,
    strokeColor: "#e03131",
    backgroundColor: "#ffc9c9",
    strokeWidth: 2,
    roughness: 0,
  });
  API.updateScene({
    elements: [node],
    appState: { selectedElementIds: { [node.id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return node;
};

describe("contextual Add step", () => {
  it.each([
    ["above", "up"],
    ["to the right", "right"],
    ["below", "down"],
    ["to the left", "left"],
  ])("creates a styled connected rectangle %s", (label, direction) => {
    const parent = selectNode();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.click(screen.getByRole("button", { name: `Add step ${label}` }));

    const nodes = h.scene
      .getNonDeletedElements()
      .filter((el) => el.type === "rectangle");
    const child = nodes.find((el) => el.id !== parent.id)!;
    const arrow = h.scene
      .getNonDeletedElements()
      .find((el) => el.type === "arrow") as ExcalidrawArrowElement;
    expect(nodes).toHaveLength(2);
    expect(child).toMatchObject({
      width: parent.width,
      height: parent.height,
      strokeColor: parent.strokeColor,
      backgroundColor: parent.backgroundColor,
      strokeWidth: parent.strokeWidth,
      roughness: parent.roughness,
    });
    expect(arrow.startBinding?.elementId).toBe(parent.id);
    expect(arrow.endBinding?.elementId).toBe(child.id);
    expect(h.state.selectedElementIds).toEqual({ [child.id]: true });
    if (direction === "up") {
      expect(child.y + child.height).toBeLessThan(parent.y);
    } else if (direction === "down") {
      expect(child.y).toBeGreaterThan(parent.y + parent.height);
    } else if (direction === "left") {
      expect(child.x + child.width).toBeLessThan(parent.x);
    } else {
      expect(child.x).toBeGreaterThan(parent.x + parent.width);
    }
  });

  it("creates a diamond and undoes/redoes the node and arrow together", async () => {
    selectNode("diamond");
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step below" }));
    expect(h.scene.getNonDeletedElements().map((el) => el.type)).toEqual([
      "diamond",
      "diamond",
      "arrow",
    ]);
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress("z"));
    expect(h.scene.getNonDeletedElements().map((el) => el.type)).toEqual([
      "diamond",
    ]);
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () =>
      Keyboard.keyPress("z"),
    );
    expect(h.scene.getNonDeletedElements().map((el) => el.type)).toEqual([
      "diamond",
      "diamond",
      "arrow",
    ]);
  });

  it("closes the picker with Escape without creating a node", () => {
    selectNode();
    const trigger = screen.getByRole("button", { name: "Add step" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("button", { name: "Add step above" }), {
      key: "Escape",
    });
    expect(
      screen.queryByRole("group", { name: "Choose next step direction" }),
    ).toBeNull();
    expect(h.elements).toHaveLength(1);
    expect(trigger).toHaveFocus();
  });

  it("hides for unsupported shapes, multiple selections and irrelevant modes", () => {
    const node = selectNode();
    const ellipse = API.createElement({ type: "ellipse" });
    API.setElements([node, ellipse]);
    API.setSelectedElements([node, ellipse]);
    expect(screen.queryByRole("button", { name: "Add step" })).toBeNull();
    API.setSelectedElements([ellipse]);
    expect(screen.queryByRole("button", { name: "Add step" })).toBeNull();
    API.setSelectedElements([node]);
    expect(screen.getByRole("button", { name: "Add step" })).toBeVisible();
    for (const state of [
      { viewModeEnabled: true },
      { zenModeEnabled: true },
      { selectedElementsAreBeingDragged: true },
      {
        activeTool: {
          ...h.state.activeTool,
          type: "hand" as const,
          customType: null,
        },
      },
    ]) {
      const previous = h.state;
      API.setAppState({ ...previous, ...state });
      expect(screen.queryByRole("button", { name: "Add step" })).toBeNull();
      API.setAppState(previous);
    }
  });

  it("repositions with zoom/pan and stays inside viewport bounds", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 300,
      y: 200,
      width: 100,
      height: 80,
    });
    const state = {
      ...getDefaultAppState(),
      width: 1000,
      height: 800,
      offsetLeft: 20,
      offsetTop: 30,
    };
    const { container, rerender } = renderDOM(
      <FlowchartAddStep element={element} appState={state} onAdd={() => {}} />,
    );
    const toolbar = container.querySelector(
      ".flowchart-add-step",
    ) as HTMLElement;
    expect(toolbar.style.left).toBe("274px");
    expect(toolbar.style.top).toBe("294px");
    act(() =>
      rerender(
        <FlowchartAddStep
          element={element}
          appState={{
            ...state,
            scrollX: 10,
            scrollY: 20,
            zoom: { value: 2 as typeof state.zoom.value },
          }}
          onAdd={() => {}}
        />,
      ),
    );
    expect(toolbar.style.left).toBe("644px");
    expect(toolbar.style.top).toBe("614px");
    act(() =>
      rerender(
        <FlowchartAddStep
          element={element}
          appState={{ ...state, scrollX: 10000, scrollY: 10000 }}
          onAdd={() => {}}
        />,
      ),
    );
    expect(toolbar.style.left).toBe("840px");
    expect(toolbar.style.top).toBe("756px");
  });
});
