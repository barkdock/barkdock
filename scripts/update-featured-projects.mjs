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

const escapeCell = (value = "") =>
  String(value)
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));

const renderRepo = (repo) => {
  const description = repo.description || "No description yet.";
  const language = repo.language || "Mixed";
  const stars = repo.stargazers_count;
  const forks = repo.forks_count;

  return `| [${escapeCell(repo.name)}](${repo.html_url}) | ${escapeCell(description)} | ${escapeCell(language)} | ${stars} stars / ${forks} forks | ${formatDate(repo.updated_at)} |`;
};

const content = featuredRepos.length
  ? [
      "| Repository | Description | Tech | Stats | Updated |",
      "| --- | --- | --- | --- | --- |",
      ...featuredRepos.map(renderRepo),
    ].join("\n")
  : "_No public repositories found yet._";

const readme = await readFile(readmePath, "utf8");
const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
const replacement = `${startMarker}\n${content}\n${endMarker}`;

if (!pattern.test(readme)) {
  throw new Error(`Could not find ${startMarker} / ${endMarker} markers in ${readmePath}`);
}

await writeFile(readmePath, readme.replace(pattern, replacement));
