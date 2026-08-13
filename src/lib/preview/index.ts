/**
 * Preview mode.
 *
 * Set SPM_PREVIEW=1 in .env.local to walk the whole product without a database.
 * Auth is bypassed, every query returns fixtures, and gameplay runs in memory
 * against the real scoring engine.
 *
 * The flag is checked at the lowest level — currentStudent(), the config
 * loaders, and the three query modules — so no page or component contains a
 * preview branch. Deleting this directory and the handful of guarded blocks
 * removes the feature entirely.
 *
 * Never enable this in production: it hands every visitor a signed-in session
 * as a fixture student.
 */
export const PREVIEW = process.env.SPM_PREVIEW === "1";

export * from "./fixtures";
export * from "./engine";
