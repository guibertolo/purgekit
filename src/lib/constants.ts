/** Polling interval for system metrics in milliseconds */
export const POLLING_INTERVAL_MS = 2000;

/** Auto-dismiss duration for toast notifications in milliseconds */
export const TOAST_DURATION_MS = 4000;

/** Default temperature thresholds (Celsius) for monitoring alerts */
export const DEFAULT_TEMP_THRESHOLDS = {
  cpu: { warning: 75, critical: 90 },
  gpu: { warning: 80, critical: 95 },
  disk: { warning: 55, critical: 70 },
} as const;

/** Sidebar width values in pixels */
export const SIDEBAR_WIDTH = {
  collapsed: 64,
  expanded: 240,
} as const;
