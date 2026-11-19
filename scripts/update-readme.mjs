// Rewrites the section between the LIVE markers in README.md with fresh public GitHub activity.
// Run: node scripts/update-readme.mjs   (GITHUB_TOKEN optional, avoids search rate limits)
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LOGIN = "ameetmadan";
const START = "<!--LIVE:START-->";
const END = "<!--LIVE:END-->";
const RECENT_COUNT = 5;
const EXTERNAL_COUNT = 6;
// Baseline/housekeeping PRs bury the real work in a feed of "what did you ship".
const HOUSEKEEPING_TITLE = /^(chore|docs|ci|build)(\(|:)/;

async function searchMergedPullRequests(extraQuery, perPage) {
  const query = `author:${LOGIN} type:pr is:merged is:public ${extraQuery}`.trim();
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&per_page=${perPage}`;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-readme-updater" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub search failed: ${response.status} ${await response.text()}`);
  const { items } = await response.json();
  return items.map((item) => ({
    repository: item.repository_url.replace("https://api.github.com/repos/", ""),
    title: item.title,
    url: item.html_url,
    mergedOn: item.closed_at.slice(0, 10),
  }));
}

const MAX_TITLE_LENGTH = 120;

// Maintainers of other people's repos can rename my PRs, and this output is committed unattended,
// so a title must never be able to add links, HTML, table cells or the LIVE markers.
const sanitizeTitle = (title) =>
  title
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
    .replace(/[\\`*_[\]()<>!#|~&]/g, "\\$&");

const pullRequestLink = (pr) => {
  if (!pr.url.startsWith("https://github.com/")) throw new Error(`Unexpected pull request URL: ${pr.url}`);
  return `[${sanitizeTitle(pr.title)}](${pr.url})`;
};

export function renderLiveSection({ recent, external }, now = new Date()) {
  const recentRows = recent
    .filter((pr) => !HOUSEKEEPING_TITLE.test(pr.title))
    .slice(0, RECENT_COUNT)
    .map((pr) => `| \`${pr.mergedOn}\` | [${pr.repository}](https://github.com/${pr.repository}) | ${pullRequestLink(pr)} |`);

  const seenRepositories = new Set();
  const externalRows = external
    .filter((pr) => !seenRepositories.has(pr.repository) && seenRepositories.add(pr.repository))
    .slice(0, EXTERNAL_COUNT)
    .map((pr) => `| [${pr.repository}](https://github.com/${pr.repository}) | ${pullRequestLink(pr)} |`);

  return [
    "#### Recently merged",
    "",
    "| Merged | Repository | Change |",
    "| --- | --- | --- |",
    ...recentRows,
    "",
    "#### Contributions to other people's projects",
    "",
    "| Project | Change |",
    "| --- | --- |",
    ...externalRows,
    "",
    `<sub>Generated from the GitHub API on ${now.toISOString().slice(0, 10)}. Public repositories only.</sub>`,
  ].join("\n");
}

export function replaceBetweenMarkers(readme, section) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1 || end < start) throw new Error(`README is missing ${START} ... ${END}`);
  return `${readme.slice(0, start + START.length)}\n${section}\n${readme.slice(end)}`;
}

async function main() {
  const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
  const [recent, external, readme] = await Promise.all([
    searchMergedPullRequests("", 40),
    searchMergedPullRequests(`-user:${LOGIN} -org:bytebuilderslab`, 30),
    readFile(readmePath, "utf8"),
  ]);
  await writeFile(readmePath, replaceBetweenMarkers(readme, renderLiveSection({ recent, external })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
