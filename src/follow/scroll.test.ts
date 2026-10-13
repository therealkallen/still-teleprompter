import { expect, it } from 'vitest';
import { followScrollTarget } from './scroll';
it('uses a reading deadband, movement threshold and separate scroll cadence', () => {
  const base = { top: 100, height: 500, now: 3000, lastMove: 0, recovery: false };
  expect(followScrollTarget({ ...base, location: 290 })).toBeNull();
  expect(followScrollTarget({ ...base, location: 450 })).toBe(260);
  expect(followScrollTarget({ ...base, location: 450, lastMove: 2800 })).toBeNull();
  expect(followScrollTarget({ ...base, location: 90, recovery: true })).toBe(0);
});
