export type ScanCategory =
  | "claude"
  | "node_modules"
  | "xcode"
  | "python"
  | "vscode"
  | "git"
  | "homebrew"
  | "docker"
  | "temp"
  | "package_caches"
  | "cocoapods"
  | "rust"
  | "go"
  | "ruby"
  | "android"
  | "ios_backups"
  | "bun_deno"
  | "system_caches"
  | "trash";

export interface ScannedLocation {
  path: string;
  category: ScanCategory;
  size_bytes: number;
  status: "active" | "stale" | "partial_stale" | "unknown";
  item_count?: number;
  children?: ScannedLocation[];
}

export interface ReclaimableItem {
  path: string;
  size_bytes: number;
  category?: ScanCategory;
  reason:
    | "stale_version"
    | "old_extension"
    | "temp_file"
    | "debug_log"
    | "cache"
    | "derived_data"
    | "old_simulator"
    | "duplicate_package"
    | "docker_cache"
    | "brew_cache"
    | "system_cache"
    | "trash"
    | "ios_backup";
  suggestion?: string;
}

export interface Installation {
  method: "native" | "homebrew" | "npm" | "unknown";
  active_version: string;
  binary_path: string;
  binary_target: string;
  other_methods_detected: string[];
}

export interface InstalledSkill {
  name: string;
  source: string;
  scope: "global" | "project";
  path: string;
}

export interface DuplicatePackage {
  name: string;
  version: string;
  locations: string[];
  size_per_copy: number;
  total_wasted_bytes: number;
}

export interface CategorySummary {
  category: ScanCategory;
  label: string;
  total_bytes: number;
  reclaimable_bytes: number;
  location_count: number;
  locations: ScannedLocation[];
}

export interface FootprintReport {
  scan_date: string;
  total_bytes: number;
  categories: CategorySummary[];
  claude?: {
    installation: Installation;
    skills: InstalledSkill[];
    plugins: string[];
  };
  duplicate_packages?: DuplicatePackage[];
  safe_to_clean: { total_bytes: number; items: ReclaimableItem[] };
  // Flat view for backwards compat / widget
  locations: ScannedLocation[];
  temp_files: { path: string; count: number; size_bytes: number };
}
