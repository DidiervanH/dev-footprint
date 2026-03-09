import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan Android SDK and related directories.
 *
 * Paths checked:
 * - ~/Library/Android/sdk/           (Android SDK)
 * - ~/.android/                       (AVD images, debug keystore)
 * - ~/.gradle/caches/                 (Gradle build cache)
 * - ~/.gradle/wrapper/dists/          (Gradle wrapper distributions)
 */
export function scanAndroid(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const locations = [
    { path: "~/Library/Android/sdk", label: "Android SDK" },
    { path: "~/.android", label: "Android config & AVDs" },
    { path: "~/.gradle/caches", label: "Gradle caches" },
    { path: "~/.gradle/wrapper/dists", label: "Gradle wrapper dists" },
  ];

  for (const loc of locations) {
    const full = expandHome(loc.path);
    if (pathExists(full)) {
      const size = getDirSize(full);
      if (size > 0) {
        children.push({
          path: collapseHome(full),
          category: "android",
          size_bytes: size,
          status: "active",
          item_count: countItems(full),
        });
      }
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Android / Gradle",
    category: "android",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
