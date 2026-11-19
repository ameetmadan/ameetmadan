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

test("neutralises hostile titles: markers, links, HTML, newlines, length", () => {
  const hostile = "x <!--LIVE:END--> [evil](https://evil.test)\n| extra | cell |<script>" + "a".repeat(300);
  const output = renderLiveSection({ recent: [pr("a/b", hostile)], external: [] });
  assert.doesNotMatch(output, /<!--LIVE:END-->/);
  assert.doesNotMatch(output, /<script>/);
  assert.doesNotMatch(output, /\[evil\]\(/);
  assert.equal(output.split("\n").filter((line) => line.startsWith("| `")).length, 1);
  assert.ok(output.length < 700);
});

test("rejects pull request URLs outside github.com", () => {
  const bad = { ...pr("a/b", "feat: x"), url: "https://evil.test/x" };
  assert.throws(() => renderLiveSection({ recent: [bad], external: [] }), /Unexpected pull request URL/);
});

test("replaces only the marked region", () => {
  const result = replaceBetweenMarkers("top\n<!--LIVE:START-->\nold\n<!--LIVE:END-->\nbottom", "new");
  assert.equal(result, "top\n<!--LIVE:START-->\nnew\n<!--LIVE:END-->\nbottom");
});

test("fails loudly when markers are missing", () => {
  assert.throws(() => replaceBetweenMarkers("no markers", "x"), /missing/);
});
