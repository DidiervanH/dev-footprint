import type { Installation, InstalledSkill } from "../types.js";

/**
 * Analyzes installations and skills for duplicates and returns an array
 * of human-readable warning strings.
 */
export function analyzeDuplicates(installation: Installation, skills: InstalledSkill[]): string[] {
  const warnings: string[] = [];

  // Check for dual installs (multiple installation methods detected)
  if (installation.other_methods_detected.length > 0) {
    const others = installation.other_methods_detected.join(", ");
    warnings.push(
      `Dual install detected: active via ${installation.method}, also found: ${others}`,
    );
  }

  // Check for duplicate skills (same name in both global and project scope)
  const skillsByName = new Map<string, Set<string>>();

  for (const skill of skills) {
    const existing = skillsByName.get(skill.name);
    if (existing) {
      existing.add(skill.scope);
    } else {
      skillsByName.set(skill.name, new Set([skill.scope]));
    }
  }

  for (const [name, scopes] of skillsByName) {
    if (scopes.has("global") && scopes.has("project")) {
      warnings.push(`Skill '${name}' installed both globally and in project`);
    }
  }

  return warnings;
}
