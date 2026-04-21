import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("app creates an express instance", async () => {
  const app = createApp();
  assert.equal(typeof app.get, "function");
  assert.equal(typeof app.use, "function");
});
