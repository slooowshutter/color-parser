import assert from "node:assert/strict";
import test from "node:test";
import { imagePoint, samplingSize } from "../lib/image-sampling";

test("scaled photo coordinates select the corresponding source pixel", () => {
  assert.deepEqual(imagePoint(150, 100, 300, 200, 6000, 4000), {
    x: 3000,
    y: 2000,
  });
  assert.deepEqual(imagePoint(300, 200, 300, 200, 6000, 4000), {
    x: 5999,
    y: 3999,
  });
  assert.deepEqual(imagePoint(-20, 500, 300, 200, 6000, 4000), {
    x: 0,
    y: 3999,
  });
  assert.deepEqual(imagePoint(0, 0, 1, 1, 1, 1), { x: 0, y: 0 });
});

test("invalid dimensions cannot become an out-of-bounds pixel read", () => {
  assert.throws(() => imagePoint(0, 0, 0, 100, 300, 300), RangeError);
  assert.throws(() => imagePoint(NaN, 0, 100, 100, 300, 300), RangeError);
  assert.throws(() => samplingSize(0, 100), RangeError);
});

test("phone canvas limits preserve aspect ratio without enlarging small images", () => {
  assert.deepEqual(samplingSize(300, 200), { width: 300, height: 200 });
  for (const [width, height] of [
    [12000, 8000],
    [8000, 12000],
    [9000, 9000],
    [20000, 1],
  ]) {
    const result = samplingSize(width, height);
    assert.ok(result.width <= 4096 && result.height <= 4096);
    assert.ok(result.width * result.height <= 12_000_000);
    assert.ok(result.width > 0 && result.height > 0);
  }
});
