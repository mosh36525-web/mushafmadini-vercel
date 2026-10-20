const REQUIRED_PLATFORM_VARIABLES = [
  "MANUS_PROJECT_ID",
  "MANUS_OAUTH_PORTAL_URL",
  "MANUS_OAUTH_API_URL",
  "MANUS_JWT_SECRET",
  "DATABASE_URL",
] as const;

export type PlatformHealth = {
  status: "ready" | "configuration_incomplete";
  missing: readonly (typeof REQUIRED_PLATFORM_VARIABLES)[number][];
};

/** Browser-safe deployment readiness: values are deliberately never returned. */
export function getPlatformHealth(env: NodeJS.ProcessEnv = process.env): PlatformHealth {
  const missing = REQUIRED_PLATFORM_VARIABLES.filter(name => !env[name]?.trim());
  return {
    status: missing.length === 0 ? "ready" : "configuration_incomplete",
    missing,
  };
}
