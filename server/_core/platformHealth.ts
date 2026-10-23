const REQUIRED_SERVICE_VARIABLES = [
  "AUTH_JWT_SECRET",
  "DATABASE_URL",
  "MYSQL_SSL_CA",
] as const;

export type PlatformHealth = {
  status: "ready" | "configuration_incomplete";
  missing: readonly (typeof REQUIRED_SERVICE_VARIABLES)[number][];
};

/** Browser-safe deployment readiness: values are deliberately never returned. */
export function getPlatformHealth(env: NodeJS.ProcessEnv = process.env): PlatformHealth {
  const missing = REQUIRED_SERVICE_VARIABLES.filter(name => {
    const value = env[name]?.trim();
    return !value || (name === "AUTH_JWT_SECRET" && value.length < 32);
  });
  return {
    status: missing.length === 0 ? "ready" : "configuration_incomplete",
    missing,
  };
}
