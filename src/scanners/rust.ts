import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan Rust/Cargo directories.
 *
 * Paths checked:
 * - ~/.cargo/registry/   (downloaded crate sources + index)
 * - ~/.cargo/bin/         (installed binaries)
 * - ~/.cargo/git/         (git checkouts of crate dependencies)
 * - ~/.rustup/            (rustup toolchains and targets)
 */
export function scanRust(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const locations = [
    { path: "~/.cargo/registry", label: "Cargo registry" },
    { path: "~/.cargo/bin", label: "Cargo binaries" },
    { path: "~/.cargo/git", label: "Cargo git deps" },
    { path: "~/.rustup", label: "Rustup toolchains" },
  ];

  for (const loc of locations) {
    const full = expandHome(loc.path);
    if (pathExists(full)) {
      const size = getDirSize(full);
      if (size > 0) {
        children.push({
          path: collapseHome(full),
          category: "rust",
          size_bytes: size,
          status: "active",
          item_count: countItems(full),
        });
      }
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Rust / Cargo",
    category: "rust",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
