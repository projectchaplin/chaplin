import assert from "node:assert/strict";
import test from "node:test";
import { characterViewerAccess } from "@/lib/character-access";

test("signed-out visitors cannot manage or cast a public actor", () => {
  assert.deepEqual(characterViewerAccess(null, "owner-1"), {
    canManage: false,
    canCast: false,
    isAdmin: false,
  });
});

test("a signed-in non-owner can cast but cannot open creator controls", () => {
  assert.deepEqual(characterViewerAccess({ id: "creator-2", role: "creator" }, "owner-1"), {
    canManage: false,
    canCast: true,
    isAdmin: false,
  });
});

test("the actor owner can manage and cast their actor", () => {
  assert.deepEqual(characterViewerAccess({ id: "owner-1", role: "creator" }, "owner-1"), {
    canManage: true,
    canCast: true,
    isAdmin: false,
  });
});

test("the allow-listed admin retains private management access", () => {
  assert.deepEqual(characterViewerAccess({ id: "admin-1", role: "admin" }, "owner-1"), {
    canManage: true,
    canCast: true,
    isAdmin: true,
  });
});
