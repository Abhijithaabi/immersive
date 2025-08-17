// src/trail.d.ts

/**
 * Describes the shape of the updateTrail function.
 * @param mouse An object with x and y coordinates (ranging from 0 to 1).
 */
export function updateTrail(mouse: { x: number; y: number }): void;

/**
 * Describes the shape of the getTrailTexture function.
 * @returns The HTMLCanvasElement used for the trail effect.
 */
export function getTrailTexture(): HTMLCanvasElement;