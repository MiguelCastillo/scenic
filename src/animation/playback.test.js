import {Elapsed, Playback} from "./playback.js";
import {range} from "../math/range.js";
import {fixed5f} from "../math/float.js";

describe("elapsed time", () => {
  it("with time moving from negative to positive skipping forward and backwards", () => {
    let elapsed = new Elapsed();
    expect(elapsed.resume(0).time(0)).toEqual(0);

    expect(range(-800, 800, 100).map((t) => elapsed.time(t, 400))).toEqual([
      400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300, 400, 100, 200, 300, 400,
    ]);

    elapsed.skip(-100);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300, 400, 100,
      200, 300, 400, 100, 200, 300,
    ]);

    elapsed.skip(-100);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300, 400,
      100, 200, 300, 400, 100, 200,
    ]);

    elapsed.skip(-100);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300,
      400, 100, 200, 300, 400, 100,
    ]);

    elapsed.skip(200);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300, 400, 100,
      200, 300, 400, 100, 200, 300,
    ]);

    elapsed.skip(300);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300, 400, 100, 200, 300, 400,
      100, 200, 300, 400, 100, 200,
    ]);

    elapsed.skip(-100);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200, 300, 400, 100, 200, 300,
      400, 100, 200, 300, 400, 100,
    ]);

    elapsed.skip(-500);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 0, 100, 200,
      300, 400, 100, 200, 300, 400,
    ]);

    elapsed.skip(-400);
    expect(range(-1200, 1200, 100).map((t) => elapsed.time(t, 400))).toEqual([
      400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200, 300, 400, 100, 200,
      300, 0, 100, 200, 300, 400,
    ]);
  });

  it("with time moving forward pausing/resuming happy path", () => {
    let elapsed = new Elapsed();
    expect(elapsed.pause(0).time(0)).toEqual(0);

    elapsed.pause(100);
    expect(elapsed.time(0)).toEqual(100);
    expect(elapsed.time(200)).toEqual(100);

    elapsed.resume(500);
    expect(elapsed.time(500)).toEqual(100);
    expect(elapsed.time(600)).toEqual(200);

    elapsed.pause(700);
    expect(elapsed.time(0)).toEqual(300);
    expect(elapsed.time(100)).toEqual(300);
    expect(elapsed.time(700)).toEqual(300);
    expect(elapsed.time(800)).toEqual(300);

    elapsed.resume(700);
    expect(range(-1000, 1000, 100).map((t) => elapsed.time(t, 600))).toEqual([
      400, 500, 600, 100, 200, 300, 400, 500, 600, 100, 200, 300, 400, 500, 0, 100, 200, 300, 400,
      500, 600,
    ]);

    elapsed.pause(700);
    expect(elapsed.time(700)).toEqual(300);
    expect(elapsed.time(900)).toEqual(300);

    elapsed.resume(800);
    expect(elapsed.time(800)).toEqual(300);
    expect(elapsed.time(1000)).toEqual(500);
    expect(elapsed.time(1200)).toEqual(700);

    elapsed.pause(1200);
    expect(elapsed.time(1200)).toEqual(700);
    expect(elapsed.time(1500)).toEqual(700);

    elapsed.skip(-100);
    expect(elapsed.time(1200)).toEqual(600);
    expect(elapsed.time(1500)).toEqual(600);

    elapsed.skip(-100);
    expect(elapsed.time(1200)).toEqual(500);
    expect(elapsed.time(1500)).toEqual(500);

    elapsed.skip(300);
    expect(elapsed.time(1200)).toEqual(800);
    expect(elapsed.time(1500)).toEqual(800);

    elapsed.resume(1300);
    expect(elapsed.time(1300)).toEqual(800);
    expect(elapsed.time(1500)).toEqual(1000);

    elapsed.skip(-100);
    expect(elapsed.time(1300)).toEqual(700);
    expect(elapsed.time(1500)).toEqual(900);

    elapsed.skip(200);
    expect(elapsed.time(1300)).toEqual(900);
    expect(elapsed.time(1500)).toEqual(1100);
  });

  it("with time moving forward but skipping large chunks of time", () => {
    let elapsed = new Elapsed();
    expect(elapsed.resume(0).time(0)).toEqual(0);

    elapsed.skip(-1000);
    expect(elapsed.time(0, 400)).toEqual(200);
    expect(elapsed.time(100, 400)).toEqual(300);

    elapsed.skip(-900);
    expect(elapsed.time(0, 400)).toEqual(100);
    expect(elapsed.time(100, 400)).toEqual(200);
  });
});

describe("Pause/Play animation", () => {
  let playback = new Playback();

  it("pausing with time reset 0", () => {
    playback.reset(0).play().setDuration(Number.MAX_SAFE_INTEGER);
    expect(playback.elapsed(0)).toEqual(0);
    expect(playback.elapsed(100)).toEqual(100);

    playback.pause(100);
    expect(playback.elapsed(200)).toEqual(100);
    expect(playback.elapsed(300)).toEqual(100);

    playback.play(500);
    expect(playback.elapsed(500)).toEqual(100);
    expect(playback.elapsed(600)).toEqual(200);
  });

  it("pausing with time reset 1", () => {
    playback.reset(1).play().setDuration(Number.MAX_SAFE_INTEGER);
    expect(playback.elapsed(1)).toEqual(0);
    expect(playback.elapsed(2)).toEqual(1);

    playback.pause(5);
    expect(playback.elapsed(5)).toEqual(4);
    expect(playback.elapsed(7)).toEqual(4);

    playback.play(9);
    expect(playback.elapsed(9)).toEqual(4);
    expect(playback.elapsed(10)).toEqual(5);
    expect(playback.elapsed(20)).toEqual(15);

    playback.pause(20);
    expect(playback.elapsed(20)).toEqual(15);
    expect(playback.elapsed(100)).toEqual(15);

    playback.play(150);
    expect(playback.elapsed(150)).toEqual(15);
    expect(playback.elapsed(170)).toEqual(35);

    playback.pause(170);
    expect(playback.elapsed(170)).toEqual(35);
    expect(playback.elapsed(171)).toEqual(35);
    expect(playback.elapsed(200)).toEqual(35);

    playback.play(200);
    expect(playback.elapsed(200)).toEqual(35);
    expect(playback.elapsed(265)).toEqual(100);
  });
});

describe("playback speed test", () => {
  describe("updateOffset", () => {
    it("with animation paused", () => {
      const playback = new Playback().pause(5500).setDuration(10000);
      const ms = 7500;
      const speed = 1.75;

      const a = playback.elapsed(ms, playback.speed);
      expect(a).toEqual(5500);
      const b = playback.elapsed(ms, speed);
      expect(b).toEqual(9625);

      playback.updateOffset(ms, speed);

      const c = playback.elapsed(ms, speed);
      expect(Math.round(c)).toEqual(5500);
      expect(Math.round(playback.elapsed(ms))).toEqual(3143);
    });

    it("with animation playing", () => {
      const playback = new Playback().play(5500).setDuration(10000);
      const ms = 7500;
      const speed = 1.75;

      const a = playback.elapsed(ms, speed);
      expect(a).toEqual(3500);
      const b = playback.elapsed(ms, playback.speed);
      expect(b).toEqual(2000);

      playback.updateOffset(ms, speed);

      const c = playback.elapsed(ms, speed);
      expect(Math.round(c)).toEqual(b);
      expect(Math.round(playback.elapsed(ms))).toEqual(1143);
    });

    // This is a tricky situation that when broken causes animation to run
    // backwards when tho playback speed is positive.
    // The issue is when we call updateOffset with a negative speed and then
    // call it again with a positive speed that is smaller than the negative
    // speed; e.g. -1 and 0.5. This causes elapsed time calculations to go
    // backwards because updateOffset will make _elapsed._offset very negative
    // so all elapsed numbers come out as negative.
    it("with unstarted animation, using negative speed and then positive speed - first case", () => {
      const playback = new Playback().setDuration(10000);

      playback.updateOffset(1000, -1);
      playback.updateOffset(4000, 0.5);
      playback.play();
      expect(playback.elapsed(7000, 0.5)).toEqual(3500);
      expect(playback.elapsed(7500, 0.5)).toEqual(3750);
    });

    // This is a tricky situation that when broken causes animation to run
    // backwards when tho playback speed is positive.
    // The issue is when we call updateOffset with a negative speed and then
    // call it again with a positive speed that is bigger than the negative
    // speed; e.g. -0.5 and 1. This causes elapsed time calculations to go
    // backwards because updateOffset will make _elapsed._offset very negative
    // so all elapsed numbers come out as negative.
    it("with unstarted animation, using negative speed and then positive speed - second case", () => {
      const playback = new Playback().setDuration(10000);

      playback.updateOffset(1000, -0.5);
      playback.updateOffset(4000, 1);
      playback.play();
      expect(playback.elapsed(7000, 1)).toEqual(7000);
      expect(playback.elapsed(7500, 1)).toEqual(7500);
    });
  });

  it("with speed range or -.5 to .5 at 500 milliseconds into the animation", () => {
    const playback = new Playback().play().setDuration(10000);

    expect(
      range(-0.5, 0.5, 0.05)
        .map((s) => {
          return playback.elapsed(500, s);
        })
        .map(fixed5f)
    ).toEqual([
      9750, 9775, 9800, 9825, 9850, 9875, 9900, 9925, 9950, 9975, 0, 25, 50, 75, 100, 125, 150, 175,
      200, 225, 250,
    ]);
  });

  it("with speed range or -.5 to .5 at 5 seconds into the animation", () => {
    const playback = new Playback().play().setDuration(10000);

    expect(
      range(-0.5, 0.5, 0.05)
        .map((s) => {
          return playback.elapsed(5000, s);
        })
        .map(fixed5f)
    ).toEqual([
      7500, 7750, 8000, 8250, 8500, 8750, 9000, 9250, 9500, 9750, 0, 250, 500, 750, 1000, 1250,
      1500, 1750, 2000, 2250, 2500,
    ]);
  });

  it("with advancing time and positive speed", () => {
    const speed = 1;
    const playback = new Playback().play(5000).setDuration(10000);

    expect(playback.elapsed(0, speed)).toEqual(5000);

    expect(
      range(6000, 7000, 100)
        .map((v) => {
          return playback.elapsed(v, speed);
        })
        .map(fixed5f)
    ).toEqual([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000]);
  });

  it("with advancing time and negative speed", () => {
    const speed = -1;
    const playback = new Playback().play(5000).setDuration(10000);

    expect(playback.elapsed(0, speed)).toEqual(5000);

    expect(
      range(7000, 8000, 100)
        .map((v) => {
          return playback.elapsed(v, speed);
        })
        .map(fixed5f)
    ).toEqual([8000, 7900, 7800, 7700, 7600, 7500, 7400, 7300, 7200, 7100, 7000]);
  });
});
