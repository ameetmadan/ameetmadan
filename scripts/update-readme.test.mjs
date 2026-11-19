import assert from "node:assert/strict";
import { test } from "node:test";
import { renderLiveSection, replaceBetweenMarkers } from "./update-readme.mjs";

const pr = (repository, title) => ({ repository, title, url: `https://github.com/${repository}/pull/1`, mergedOn: "2026-11-18" });

test("hides housekeeping PRs and keeps real work", () => {
  const output = renderLiveSection({ recent: [pr("a/b", "chore: bump"), pr("a/b", "feat: add search")], external: [] });
  assert.match(output, /feat: add search/);
  assert.doesNotMatch(output, /chore: bump/);
});

test("lists each external project once and escapes pipes", () => {
  const output = renderLiveSection({ recent: [], external: [pr("x/y", "fix: a | b"), pr("x/y", "fix: second")] });
  assert.match(output, /fix: a \\\| b/);
  assert.doesNotMatch(output, /fix: second/);
});

test("replaces only the marked region", () => {
  const result = replaceBetweenMarkers("top\n<!--LIVE:START-->\nold\n<!--LIVE:END-->\nbottom", "new");
  assert.equal(result, "top\n<!--LIVE:START-->\nnew\n<!--LIVE:END-->\nbottom");
});

test("fails loudly when markers are missing", () => {
  assert.throws(() => replaceBetweenMarkers("no markers", "x"), /missing/);
});
