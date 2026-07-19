/**
 * Canvas utility functions for AR overlay rendering.
 * These will be implemented in Phase 1.
 */

export function createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  // Fallback: create a regular canvas wrapped in a mock
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas as unknown as OffscreenCanvas
}

export function getCanvasContext(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: '2d' | 'webgl' | 'webgl2' = '2d'
): CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext | null {
  const ctx = canvas.getContext(type)
  if (ctx instanceof CanvasRenderingContext2D) return ctx
  if (ctx instanceof WebGLRenderingContext) return ctx
  if (ctx instanceof WebGL2RenderingContext) return ctx
  return null
}


export function resizeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number
): void {
  canvas.width = width
  canvas.height = height
}
