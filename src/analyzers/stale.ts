import type { ReclaimableItem, ScannedLocation } from "../types.js";
import { expandHome, shellEscape } from "../utils.js";

type ReclaimReason = ReclaimableItem["reason"];

/**
 * Determines the reclaimable reason for a stale location based on its path
 * and category.
 */
function classifyReason(location: ScannedLocation): ReclaimReason {
  const p = location.path.toLowerCase();

  // Temp files
  if (location.category === "temp") return "temp_file";
  if (p.includes("/tmp") || p.includes("temp")) return "temp_file";

  // Xcode derived data / caches
  if (location.category === "xcode") {
    if (p.includes("deriveddata")) return "derived_data";
    if (p.includes("cache")) return "cache";
    if (p.includes("simulator")) return "old_simulator";
    return "cache";
  }

  // Docker
  if (location.category === "docker") return "docker_cache";

  // Homebrew cache
  if (location.category === "homebrew" && p.includes("cache")) return "brew_cache";

  // System caches
  if (location.category === "system_caches") return "system_cache";

  // Trash
  if (location.category === "trash") return "trash";

  // iOS backups
  if (location.category === "ios_backups") return "ios_backup";

  // Debug logs
  if (p.includes("debug")) return "debug_log";

  // Cache directories
  if (p.includes("cache")) return "cache";

  // Old extension versions
  if (p.includes("extension") || p.includes("vscode") || p.includes("vsix")) {
    return "old_extension";
  }

  // Stale versioned artifacts
  if (p.includes("versions")) return "stale_version";

  return "stale_version";
}

/**
 * Returns the appropriate shell command to clean up a given reclaimable location.
 */
function getCleanupCommand(location: ScannedLocation): string | undefined {
  const p = location.path.toLowerCase();
  const rawPath = location.path;

  // Package caches
  if (location.category === "package_caches") {
    if (p.includes(".npm")) return "npm cache clean --force";
    if (p.includes("yarn")) return "rm -rf ~/Library/Caches/Yarn";
    return undefined;
  }

  // Python pip cache
  if (location.category === "python" && p.includes("cache")) {
    return "pip cache purge";
  }

  // Homebrew cache
  if (location.category === "homebrew" && p.includes("cache")) {
    return "brew cleanup --prune=all";
  }

  // CocoaPods cache
  if (location.category === "cocoapods" && p.includes("cache")) {
    return "rm -rf ~/Library/Caches/CocoaPods";
  }

  // Xcode
  if (location.category === "xcode") {
    if (p.includes("deriveddata")) return "rm -rf ~/Library/Developer/Xcode/DerivedData";
    if (p.includes("cache")) return `rm -rf ${shellEscape(expandHome(rawPath))}`;
    return undefined;
  }

  // VS Code
  if (location.category === "vscode") {
    if (p.includes("cachedextensionvsixs") || p.includes("logs")) {
      return `rm -rf ${shellEscape(expandHome(rawPath))}`;
    }
    return undefined;
  }

  // System caches
  if (location.category === "system_caches") {
    return `rm -rf ${shellEscape(expandHome(rawPath))}`;
  }

  // Trash
  if (location.category === "trash") return "rm -rf ~/.Trash/*";

  // Temp files
  if (location.category === "temp") return "rm -rf /tmp/claude-*";

  // Docker
  if (location.category === "docker") return "docker system prune";

  return undefined;
}

/**
 * Recursively walks a ScannedLocation tree and collects all stale items
 * as ReclaimableItems, with cleanup commands populated in the suggestion field.
 */
function collectStaleItems(location: ScannedLocation, results: ReclaimableItem[]): void {
  if (location.status === "stale") {
    results.push({
      path: location.path,
      size_bytes: location.size_bytes,
      category: location.category,
      reason: classifyReason(location),
      suggestion: getCleanupCommand(location),
    });
  }

  if (location.children) {
    for (const child of location.children) {
      collectStaleItems(child, results);
    }
  }
}

/**
 * Analyzes all scanned locations (including nested children) and returns
 * a list of reclaimable items for any location marked as "stale".
 */
export function analyzeStale(locations: ScannedLocation[]): ReclaimableItem[] {
  const results: ReclaimableItem[] = [];

  for (const location of locations) {
    collectStaleItems(location, results);
  }

  return results;
}

/**
 * Returns the total size in bytes of all reclaimable items.
 */
export function getReclaimableTotal(items: ReclaimableItem[]): number {
  return items.reduce((sum, item) => sum + item.size_bytes, 0);
}
