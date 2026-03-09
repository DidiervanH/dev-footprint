import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

interface DockerDir {
  tilePath: string;
  label: string;
}

const DOCKER_DIRS: DockerDir[] = [
  {
    tilePath: "~/Library/Containers/com.docker.docker/",
    label: "Docker Desktop Data",
  },
  {
    tilePath: "~/.docker/",
    label: "Docker Config & Plugins",
  },
];

/**
 * Scan Docker Desktop data directories on macOS.
 *
 * Checks:
 * 1. ~/Library/Containers/com.docker.docker/ — main Docker data
 * 2. ~/.docker/ — Docker config and plugins
 *
 * Returns a single top-level ScannedLocation with children for each found path.
 */
export function scanDocker(): ScannedLocation {
  const children: ScannedLocation[] = [];

  try {
    for (const dir of DOCKER_DIRS) {
      const fullPath = expandHome(dir.tilePath);

      if (!pathExists(fullPath)) continue;

      const size = getDirSize(fullPath);
      const items = countItems(fullPath);

      children.push({
        path: collapseHome(fullPath),
        category: "docker",
        size_bytes: size,
        status: "active",
        item_count: items,
      });
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Docker",
    category: "docker",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
