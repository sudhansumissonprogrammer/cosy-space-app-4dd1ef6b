export type CapacityProfileId = "baseline" | "canary" | "ramp" | "spike" | "soak";

export interface CapacityStage {
  users: number;
  requestsPerSecond: number;
  durationSeconds: number;
}

export interface CapacityProfile {
  id: CapacityProfileId;
  label: string;
  description: string;
  productionSafe: boolean;
  stages: CapacityStage[];
}

export const CAPACITY_PROFILES: Record<CapacityProfileId, CapacityProfile> = {
  baseline: {
    id: "baseline",
    label: "Baseline",
    description: "A tiny health measurement before any larger test.",
    productionSafe: true,
    stages: [{ users: 1, requestsPerSecond: 0.5, durationSeconds: 12 }],
  },
  canary: {
    id: "canary",
    label: "Live canary",
    description: "Maximum read-only check permitted on a live website.",
    productionSafe: true,
    stages: [{ users: 2, requestsPerSecond: 1, durationSeconds: 30 }],
  },
  ramp: {
    id: "ramp",
    label: "Ramp to limit",
    description: "Raises traffic in stages and stops at the first danger signal.",
    productionSafe: false,
    stages: [
      { users: 5, requestsPerSecond: 3, durationSeconds: 60 },
      { users: 10, requestsPerSecond: 6, durationSeconds: 90 },
      { users: 25, requestsPerSecond: 15, durationSeconds: 120 },
      { users: 50, requestsPerSecond: 30, durationSeconds: 120 },
      { users: 100, requestsPerSecond: 60, durationSeconds: 120 },
    ],
  },
  spike: {
    id: "spike",
    label: "Ad spike",
    description: "Simulates a sudden campaign burst followed by recovery.",
    productionSafe: false,
    stages: [
      { users: 10, requestsPerSecond: 5, durationSeconds: 20 },
      { users: 75, requestsPerSecond: 60, durationSeconds: 45 },
      { users: 10, requestsPerSecond: 5, durationSeconds: 20 },
    ],
  },
  soak: {
    id: "soak",
    label: "30-minute soak",
    description: "Checks stability, memory pressure, and slow degradation.",
    productionSafe: false,
    stages: [{ users: 25, requestsPerSecond: 12, durationSeconds: 1800 }],
  },
};

const PRODUCTION_HOSTS = new Set([
  "shopbanao.in",
  "www.shopbanao.in",
  "serdiyajewellers.com",
  "www.serdiyajewellers.com",
  "serdiyajewellers.shop",
  "www.serdiyajewellers.shop",
  "imitationworld.in",
  "www.imitationworld.in",
  "cosy-space-app.lovable.app",
]);

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
];

const BLOCKED_PATH_PREFIXES = [
  "/admin",
  "/account",
  "/cart",
  "/checkout",
  "/login",
  "/api",
  "/payment",
  "/orders",
  "/webhook",
];

const STAGING_MARKERS = ["staging", "stage", "preview", "test", "qa", "dev"];

export interface TargetValidation {
  valid: boolean;
  normalizedUrl: string;
  message: string;
}

export function validateCapacityTarget(value: string, profileId: CapacityProfileId): TargetValidation {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { valid: false, normalizedUrl: "", message: "Enter a complete HTTPS website address." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const path = parsed.pathname.toLowerCase();
  if (parsed.protocol !== "https:") {
    return { valid: false, normalizedUrl: "", message: "Only HTTPS websites are accepted." };
  }
  if (parsed.username || parsed.password || parsed.port) {
    return { valid: false, normalizedUrl: "", message: "Credentials and custom ports are not accepted." };
  }
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { valid: false, normalizedUrl: "", message: "Local and private-network addresses are blocked." };
  }
  if (BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return { valid: false, normalizedUrl: "", message: "Start from the website homepage, not a private, checkout, or payment page." };
  }

  const productionMatch = PRODUCTION_HOSTS.has(hostname)
    || [...PRODUCTION_HOSTS].some((item) => hostname.endsWith(`.${item}`));
  const profile = CAPACITY_PROFILES[profileId];
  if (productionMatch && !profile.productionSafe) {
    return { valid: false, normalizedUrl: "", message: "Aggressive tests are permanently blocked on known live websites." };
  }
  if (!profile.productionSafe && !STAGING_MARKERS.some((marker) => hostname.includes(marker))) {
    return { valid: false, normalizedUrl: "", message: "Aggressive tests require a hostname marked staging, stage, preview, test, qa, or dev." };
  }

  return {
    valid: true,
    normalizedUrl: `${parsed.protocol}//${hostname}`,
    message: profile.productionSafe ? "Approved for a low-rate read-only check." : "Approved as a staging target.",
  };
}

export function profileTotals(profile: CapacityProfile) {
  const totalRequests = profile.stages.reduce(
    (sum, stage) => sum + Math.ceil(stage.requestsPerSecond * stage.durationSeconds),
    0,
  );
  const durationSeconds = profile.stages.reduce((sum, stage) => sum + stage.durationSeconds, 0)
    + Math.max(0, profile.stages.length - 1) * 3;
  const peakUsers = Math.max(...profile.stages.map((stage) => stage.users));
  const peakRequestsPerSecond = Math.max(...profile.stages.map((stage) => stage.requestsPerSecond));
  return { totalRequests, durationSeconds, peakUsers, peakRequestsPerSecond };
}