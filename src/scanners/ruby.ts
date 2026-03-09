import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan Ruby/gems directories.
 *
 * Paths checked:
 * - ~/.gem/              (user-installed gems)
 * - ~/.rbenv/            (rbenv Ruby versions)
 * - ~/.rvm/              (RVM Ruby versions)
 * - /usr/local/lib/ruby/gems/  (system gems on Intel Macs)
 */
export function scanRuby(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const locations = [
    { path: "~/.gem", label: "Ruby gems" },
    { path: "~/.rbenv", label: "rbenv" },
    { path: "~/.rvm", label: "RVM" },
  ];

  for (const loc of locations) {
    const full = expandHome(loc.path);
    if (pathExists(full)) {
      const size = getDirSize(full);
      if (size > 0) {
        children.push({
          path: collapseHome(full),
          category: "ruby",
          size_bytes: size,
          status: "active",
          item_count: countItems(full),
        });
      }
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Ruby / Gems",
    category: "ruby",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
