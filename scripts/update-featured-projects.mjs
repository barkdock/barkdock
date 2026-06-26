import { readFile, writeFile } from "node:fs/promises";

const owner = process.env.OWNER || process.env.GITHUB_REPOSITORY_OWNER || "barkdock";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const readmePath = "README.md";
const startMarker = "<!-- FEATURED-PROJECTS:START -->";
const endMarker = "<!-- FEATURED-PROJECTS:END -->";

const headers = {
  "Accept": "application/vnd.github+json",
  "User-Agent": `${owner}-profile-readme-updater`,
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const response = await fetch(
  `https://api.github.com/users/${owner}/repos?type=owner&sort=updated&per_page=100`,
  { headers },
);

if (!response.ok) {
  throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
}

const repos = await response.json();

const featuredRepos = repos
  .filter((repo) => !repo.fork && !repo.archived && repo.name.toLowerCase() !== owner.toLowerCase())
  .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  .slice(0, 6);

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, " ")
    .trim();

const badgeUrl = (label, message, color) => {
  const safeLabel = encodeURIComponent(label);
  const safeMessage = encodeURIComponent(String(message || "unknown"));

  return `https://img.shields.io/badge/${safeLabel}-${safeMessage}-${color}?style=flat-square`;
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));

const renderRepoCard = (repo) => {
  const description = repo.description || "Active project in progress.";
  const language = repo.language || "Mixed";
  const stars = `${repo.stargazers_count} stars`;
  const forks = `${repo.forks_count} forks`;
  const updated = formatDate(repo.updated_at);

  return [
    '<td width="50%" valign="top">',
    `  <h3><a href="${escapeHtml(repo.html_url)}">${escapeHtml(repo.name)}</a></h3>`,
    `  <p>${escapeHtml(description)}</p>`,
    "  <p>",
    `    <img src="${badgeUrl("Tech", language, "2563eb")}" alt="${escapeHtml(language)}" />`,
    `    <img src="${badgeUrl("Stars", stars, "f59e0b")}" alt="${escapeHtml(stars)}" />`,
    `    <img src="${badgeUrl("Forks", forks, "14b8a6")}" alt="${escapeHtml(forks)}" />`,
    `    <img src="${badgeUrl("Updated", updated, "64748b")}" alt="Updated ${escapeHtml(updated)}" />`,
    "  </p>",
    "</td>",
  ].join("\n");
};

const renderRepoGrid = (repos) => {
  const rows = [];

  for (let index = 0; index < repos.length; index += 2) {
    const first = renderRepoCard(repos[index]);
    const second = repos[index + 1] ? renderRepoCard(repos[index + 1]) : '<td width="50%" valign="top"></td>';

    rows.push(["<tr>", first, second, "</tr>"].join("\n"));
  }

  return ["<table>", ...rows, "</table>"].join("\n");
};

const content = featuredRepos.length
  ? renderRepoGrid(featuredRepos)
  : "_No public repositories found yet._";

const readme = await readFile(readmePath, "utf8");
const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
const replacement = `${startMarker}\n${content}\n${endMarker}`;

if (!pattern.test(readme)) {
  throw new Error(`Could not find ${startMarker} / ${endMarker} markers in ${readmePath}`);
}

await writeFile(readmePath, readme.replace(pattern, replacement));
