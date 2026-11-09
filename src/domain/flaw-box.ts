/**
 * A verifier tags a flaw by tapping the spot on a photo. We store a small box
 * around the tap, in fractions of the photo size (0 to 1), so it lines up
 * with the photo at any resolution and can be used as a training label.
 */
export const DEFAULT_BOX_SIZE = 0.16;

export type Box = { x: number; y: number; w: number; h: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Box centered on the tap, kept fully inside the photo. `size` is the width
 * as a fraction of the photo width; pass the photo's width/height as `aspect`
 * so the box comes out square on screen.
 */
export function boxAroundTap(tapX: number, tapY: number, size = DEFAULT_BOX_SIZE, aspect = 1): Box {
  const w = clamp(size, 0, 1);
  const h = clamp(size * aspect, 0, 1);
  return {
    x: clamp(clamp(tapX, 0, 1) - w / 2, 0, 1 - w),
    y: clamp(clamp(tapY, 0, 1) - h / 2, 0, 1 - h),
    w,
    h,
  };
}
