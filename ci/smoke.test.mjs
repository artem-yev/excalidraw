import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("workspace package.json is valid", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(pkg.workspaces, "workspaces defined");
});

test("app entry point exists", () => {
  assert.ok(existsSync("excalidraw-app/App.tsx"));
});

test("flowchart module exists", () => {
  assert.ok(existsSync("packages/element/src/flowchart.ts"));
});

test("README exists", () => {
  assert.ok(existsSync("README.md"));
});
