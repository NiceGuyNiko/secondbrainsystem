import test from "node:test";
import assert from "node:assert/strict";
import {
  DATABASE_CATEGORIES, categoryForKind, databaseById,
} from "../lib/database-categories";

test("the database destination exposes all sixteen prototype categories", () => {
  assert.equal(DATABASE_CATEGORIES.length, 16);
  assert.deepEqual(DATABASE_CATEGORIES.map((c) => c.label), [
    "Characters", "Events", "Groups", "Locations", "Perspectives", "Scenes",
    "Chapters", "Books", "Projects", "Themes", "Factions", "Items",
    "Species / Races", "Magic / Powers", "Concepts", "Notes",
  ]);
  assert.equal(new Set(DATABASE_CATEGORIES.map((c) => c.id)).size, 16);
});

test("existing canonical planning kinds are reused, unsupported kinds are never fabricated", () => {
  assert.equal(databaseById("Characters").kind, "character");
  assert.equal(databaseById("Events").kind, "event");
  assert.equal(databaseById("Perspectives").kind, "perspective");
  assert.equal(databaseById("Scenes").kind, "scene");
  assert.equal(databaseById("Projects").kind, "project");
  assert.equal(categoryForKind("character"), "Characters");
  assert.equal(categoryForKind("event"), "Events");
  assert.equal(categoryForKind("perspective"), "Perspectives");
  assert.equal(categoryForKind("scene"), "Scenes");
  assert.equal(categoryForKind("project"), "Projects");
  for (const category of DATABASE_CATEGORIES.filter((c) => !c.kind)) {
    assert.equal(category.kind, null);
  }
  assert.equal(categoryForKind("task"), null);
  assert.equal(categoryForKind("workspace"), null);
});

test("all categories describe their purpose and have stable routing IDs", () => {
  for (const category of DATABASE_CATEGORIES) {
    assert.ok(category.id.trim());
    assert.ok(category.description.trim());
    assert.equal(databaseById(category.id), category);
  }
});
