import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

interface XcodeDir {
  tilePath: string;
  label: string;
  status: "active" | "stale";
}

const XCODE_DIRS: XcodeDir[] = [
  {
    tilePath: "~/Library/Developer/Xcode/DerivedData/",
    label: "DerivedData",
    status: "active",
  },
  {
    tilePath: "~/Library/Developer/Xcode/Archives/",
    label: "Archives",
    status: "active",
  },
  {
    tilePath: "~/Library/Developer/CoreSimulator/Devices/",
    label: "Simulator Devices",
    status: "active",
  },
  {
    tilePath: "~/Library/Developer/CoreSimulator/Caches/",
    label: "Simulator Caches",
    status: "stale",
  },
  {
    tilePath: "~/Library/Caches/com.apple.dt.Xcode/",
    label: "Xcode Caches",
    status: "stale",
  },
];

/**
 * Scan Xcode and iOS Simulator disk usage on macOS.
 *
 * Reports DerivedData, Archives, Simulator Devices/Caches, and Xcode caches.
 * Returns a single top-level ScannedLocation with children for each found directory.
 */
export function scanXcode(): ScannedLocation {
  const children: ScannedLocation[] = [];

  for (const dir of XCODE_DIRS) {
    const fullPath = expandHome(dir.tilePath);

    if (!pathExists(fullPath)) {
      continue;
    }

    const size = getDirSize(fullPath);
    const items = countItems(fullPath);

    children.push({
      path: collapseHome(fullPath),
      category: "xcode",
      size_bytes: size,
      status: dir.status,
      item_count: items,
    });
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Xcode & Simulators",
    category: "xcode",
    size_bytes: totalSize,
    status: "active",
    item_count: children.length,
    children,
  };
}
