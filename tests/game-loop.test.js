import test from "node:test";
import assert from "node:assert/strict";
import { GameLoop } from "../src/core/game-loop.js";

function withAnimationFrameStubs(run) {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let nextId = 1;
  const pending = new Map();
  const cancelled = [];

  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
    pending.delete(id);
  };

  try {
    run({ pending, cancelled });
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
}

test("game loop is idempotent, caps delta time, and cancels its pending frame", () => {
  withAnimationFrameStubs(({ pending, cancelled }) => {
    const deltas = [];
    let renderCount = 0;
    const loop = new GameLoop((delta) => deltas.push(delta), () => renderCount++);

    loop.start();
    loop.start();
    assert.equal(pending.size, 1);

    const [frameId, callback] = pending.entries().next().value;
    pending.delete(frameId);
    callback(performance.now() + 1000);

    assert.equal(deltas.length, 1);
    assert.equal(deltas[0], 0.05);
    assert.equal(renderCount, 1);
    assert.equal(pending.size, 1);

    const pendingId = [...pending.keys()][0];
    loop.stop();
    assert.equal(loop.running, false);
    assert.equal(pending.size, 0);
    assert.deepEqual(cancelled, [pendingId]);
  });
});

test("game loop can restart after stop without creating multiple pending frames", () => {
  withAnimationFrameStubs(({ pending }) => {
    const loop = new GameLoop(() => {}, () => {});
    loop.start();
    loop.stop();
    loop.start();
    assert.equal(pending.size, 1);
    loop.stop();
    assert.equal(pending.size, 0);
  });
});
