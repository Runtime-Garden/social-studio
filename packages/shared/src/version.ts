/**
 * Version and contract identifiers shared by the offline editor and the
 * online v3 workspace. These are contract values: change deliberately.
 */

/** Product version written by tooling; informational only. */
export const STUDIO_VERSION = '3.0.0-dev';

/**
 * Marker present in every `.rgstudio.json` export. Both v1 and v2 files use
 * this value; `version` expresses the file schema generation.
 */
export const PROJECT_FORMAT_MARKER = 'runtime-garden-social-studio';

/**
 * Browser localStorage key used by the offline v2 editor for autosave.
 * Changing this key without a migration silently discards users' saved work.
 */
export const OFFLINE_STORAGE_KEY = 'rg-social-studio-v1';

/** Highest offline project file version written today. */
export const OFFLINE_PROJECT_VERSION = 2;

/** Offline project file versions the editor must keep importing. */
export const SUPPORTED_OFFLINE_PROJECT_VERSIONS = [1, 2] as const;
