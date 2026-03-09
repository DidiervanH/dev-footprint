import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Installation } from "../types.js";
import { expandHome, pathExists } from "../utils.js";

const EXEC_OPTS = {
  encoding: "utf-8" as const,
  stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
};

interface DetectedMethod {
  method: "native" | "homebrew" | "npm";
  version: string;
  binaryPath: string;
  binaryTarget: string;
}

function detectNative(): DetectedMethod | null {
  const binPath = expandHome("~/.local/bin/claude");
  if (!pathExists(binPath)) {
    return null;
  }

  let target = "";
  let version = "";

  try {
    const stat = fs.lstatSync(binPath);
    if (stat.isSymbolicLink()) {
      target = fs.readlinkSync(binPath);
      // Extract version from paths like ~/.local/share/claude/versions/2.1.71/...
      const versionMatch = target.match(/versions\/([^/]+)/);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }
  } catch {
    // Could not read symlink
  }

  return {
    method: "native",
    version,
    binaryPath: binPath,
    binaryTarget: target,
  };
}

function detectHomebrew(): DetectedMethod | null {
  const caskDirs = ["/opt/homebrew/Caskroom/claude-code", "/usr/local/Caskroom/claude-code"];

  for (const caskDir of caskDirs) {
    if (!pathExists(caskDir)) {
      continue;
    }

    let version = "";
    try {
      const entries = fs.readdirSync(caskDir);
      // Filter out hidden entries like .metadata
      const versions = entries.filter((e) => !e.startsWith("."));
      if (versions.length > 0) {
        // Sort to get the latest version
        version = versions.sort().reverse()[0];
      }
    } catch {
      // Could not read directory
    }

    // Homebrew typically links to /opt/homebrew/bin/claude or /usr/local/bin/claude
    const isArm = caskDir.startsWith("/opt/homebrew");
    const binPath = isArm ? "/opt/homebrew/bin/claude" : "/usr/local/bin/claude";

    return {
      method: "homebrew",
      version,
      binaryPath: binPath,
      binaryTarget: "",
    };
  }

  return null;
}

function detectNpm(): DetectedMethod | null {
  try {
    const output = execSync(
      "npm list -g @anthropic-ai/claude-code --depth=0 2>/dev/null",
      EXEC_OPTS,
    );

    // Output looks like: /path/to/lib
    // `-- @anthropic-ai/claude-code@1.2.3
    const versionMatch = output.match(/@anthropic-ai\/claude-code@(\S+)/);
    if (!versionMatch) {
      return null;
    }

    const version = versionMatch[1];

    // Determine npm global binary path
    let binPath = "";
    try {
      const prefix = execSync("npm prefix -g", EXEC_OPTS).trim();
      binPath = path.join(prefix, "bin", "claude");
    } catch {
      // fallback
    }

    return {
      method: "npm",
      version,
      binaryPath: binPath,
      binaryTarget: "",
    };
  } catch {
    return null;
  }
}

function detectActiveBinary(): { path: string; target: string } {
  try {
    const whichOutput = execSync("which claude", EXEC_OPTS).trim();
    let target = "";
    try {
      const stat = fs.lstatSync(whichOutput);
      if (stat.isSymbolicLink()) {
        target = fs.readlinkSync(whichOutput);
      }
    } catch {
      // not a symlink or cannot read
    }
    return { path: whichOutput, target };
  } catch {
    return { path: "", target: "" };
  }
}

function matchMethodFromPath(
  binaryPath: string,
  detected: DetectedMethod[],
): DetectedMethod | null {
  if (!binaryPath) return null;

  // Check native
  if (binaryPath.includes(".local/bin") || binaryPath.includes(".local/share/claude")) {
    return detected.find((d) => d.method === "native") ?? null;
  }

  // Check homebrew
  if (
    binaryPath.includes("/opt/homebrew/") ||
    binaryPath.includes("/usr/local/Caskroom/") ||
    binaryPath === "/usr/local/bin/claude"
  ) {
    return detected.find((d) => d.method === "homebrew") ?? null;
  }

  // Check npm
  if (
    binaryPath.includes("npm") ||
    binaryPath.includes("node_modules") ||
    binaryPath.includes("nvm") ||
    binaryPath.includes("fnm") ||
    binaryPath.includes("n/bin")
  ) {
    return detected.find((d) => d.method === "npm") ?? null;
  }

  return null;
}

export async function scanInstallation(): Promise<Installation> {
  const detected: DetectedMethod[] = [];

  const native = detectNative();
  if (native) detected.push(native);

  const homebrew = detectHomebrew();
  if (homebrew) detected.push(homebrew);

  const npm = detectNpm();
  if (npm) detected.push(npm);

  if (detected.length === 0) {
    return {
      method: "unknown",
      active_version: "",
      binary_path: "",
      binary_target: "",
      other_methods_detected: [],
    };
  }

  // Determine which method is actively in use
  const active = detectActiveBinary();
  const activeMethod = matchMethodFromPath(active.path, detected);

  // Pick the primary: active binary match, or first detected
  const primary = activeMethod ?? detected[0];

  const otherMethods = detected.filter((d) => d.method !== primary.method).map((d) => d.method);

  return {
    method: primary.method,
    active_version: primary.version,
    binary_path: active.path || primary.binaryPath,
    binary_target: active.target || primary.binaryTarget,
    other_methods_detected: otherMethods,
  };
}
