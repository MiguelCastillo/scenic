import {Animate2v, Animate3v, AnimateScalar} from "./keyframe.js";
import {Playback} from "./playback.js";
import {range} from "../math/range.js";
import {fixed5f} from "../math/float.js";

// Let's disable console log to keep the reports clean.
jest.spyOn(console, "log").mockImplementation(() => {});

describe("animate2v", () => {
  it("no frames does not throw error", () => {
    expect(() => {
      new Animate2v([]);
    }).not.toThrow();
  });

  it("with 1 frame does not throw error", () => {
    expect(() => {
      new Animate2v([[6, 7]]);
    }).not.toThrow();
  });

  it("with 2 frames and multiple MS interval from 0 to 1 sec", () => {
    const animator = new Animate2v([
      [1, 2],
      [6, 7],
    ]);

    const playback = new Playback().play().setDuration(animator.duration);
    const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed));

    // (6-1)*0 + 1 = 0 + 1 = 1
    // (7-2)*0 + 2 = 0 + 2 = 2
    expect(animate(0)).toEqual([1, 2]);

    // (6-1)*0.5 + 1 = 5*0.5 + 1 = 3.5
    // (7-2)*0.5 + 2 = 5*0.5 + 2 = 4.5
    expect(animate(500)).toEqual([3.5, 4.5]);

    // (6-1)*0.55 + 1 = 5*0.55 + 1 = 3.75
    // (7-2)*0.55 + 2 = 5*0.55 + 2 = 4.75
    expect(animate(550)).toEqual([3.75, 4.75]);

    // (6-1)*0.6 + 1 = 5*0.6 + 1 = 4
    // (7-2)*0.6 + 2 = 5*0.6 + 2 = 5
    expect(animate(600)).toEqual([4, 5]);

    // (6-1)*0.65 + 1 = 5*0.65 + 1 = 4.25
    // (7-2)*0.65 + 2 = 5*0.65 + 2 = 5.25
    expect(animate(650)).toEqual([4.25, 5.25]);

    // (6-1)*0.7 + 1 = 5*0.7 + 1 = 4.5
    // (7-2)*0.7 + 2 = 5*0.7 + 2 = 5.5
    expect(animate(700)).toEqual([4.5, 5.5]);

    // (6-1)*0.75 + 1 = 5*0.75 + 1 = 4.75
    // (7-2)*0.75 + 2 = 5*0.75 + 2 = 5.75
    expect(animate(750)).toEqual([4.75, 5.75]);

    // (6-1)*0.8 + 1 = 5*0.8 + 1 = 5
    // (7-2)*0.8 + 2 = 5*0.8 + 2 = 6
    expect(animate(800)).toEqual([5, 6]);

    // (6-1)*0.85 + 1 = 5*0.85 + 1 = 5.25
    // (7-2)*0.85 + 2 = 5*0.85 + 2 = 6.25
    expect(animate(850)).toEqual([5.25, 6.25]);

    // (6-1)*0.95 + 1 = 5*0.95 + 1 = 5.75
    // (7-2)*0.95 + 2 = 5*0.95 + 2 = 6.75
    expect(animate(950)).toEqual([5.75, 6.75]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*1 + 1 = 5 + 1 = 6
    // (7-2)*1 + 2 = 5 + 2 = 7
    expect(animate(1000)).toEqual([6, 7]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*.001 + 1 = .005 + 1 = 1.005
    // (7-2)*.001 + 2 = .005 + 2 = 2.005
    expect(animate(1001)).toEqual([1.005, 2.005]);
  });
});

describe("animate3v", () => {
  it("with no frames does not throw error", () => {
    expect(() => {
      new Animate3v([]);
    }).not.toThrow();
  });

  it("with 1 frame does not throw error", () => {
    expect(() => {
      new Animate3v([[6, 7, 8]]);
    }).not.toThrow();
  });

  it("with 2 frames and multiple MS interval from 0 to 1 sec", () => {
    const animator = new Animate3v([
      [1, 2, 3],
      [6, 7, 8],
    ]);

    const playback = new Playback().play().setDuration(animator.duration);
    const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed));

    // (6-1)*0 + 1 = 0 + 1 = 1
    // (7-2)*0 + 2 = 0 + 2 = 2
    // (8-3)*0 + 3 = 0 + 3 = 3
    expect(animate(0)).toEqual([1, 2, 3]);

    // (6-1)*0.5 + 1 = 5*0.5 + 1 = 3.5
    // (7-2)*0.5 + 2 = 5*0.5 + 2 = 4.5
    // (8-3)*0.5 + 3 = 5*0.5 + 3 = 5.5
    expect(animate(500)).toEqual([3.5, 4.5, 5.5]);

    // (6-1)*0.55 + 1 = 5*0.55 + 1 = 3.75
    // (7-2)*0.55 + 2 = 5*0.55 + 2 = 4.75
    // (8-3)*0.55 + 3 = 5*0.55 + 3 = 5.75
    expect(animate(550)).toEqual([3.75, 4.75, 5.75]);

    // (6-1)*0.6 + 1 = 5*0.6 + 1 = 4
    // (7-2)*0.6 + 2 = 5*0.6 + 2 = 5
    // (8-3)*0.6 + 3 = 5*0.6 + 3 = 6
    expect(animate(600)).toEqual([4, 5, 6]);

    // (6-1)*0.65 + 1 = 5*0.65 + 1 = 4.25
    // (7-2)*0.65 + 2 = 5*0.65 + 2 = 5.25
    // (8-3)*0.65 + 3 = 5*0.65 + 3 = 6.25
    expect(animate(650)).toEqual([4.25, 5.25, 6.25]);

    // (6-1)*0.7 + 1 = 5*0.7 + 1 = 4.5
    // (7-2)*0.7 + 2 = 5*0.7 + 2 = 5.5
    // (8-3)*0.7 + 3 = 5*0.7 + 3 = 6.5
    expect(animate(700)).toEqual([4.5, 5.5, 6.5]);

    // (6-1)*0.75 + 1 = 5*0.75 + 1 = 4.75
    // (7-2)*0.75 + 2 = 5*0.75 + 2 = 5.75
    // (8-3)*0.75 + 3 = 5*0.75 + 3 = 6.75
    expect(animate(750)).toEqual([4.75, 5.75, 6.75]);

    // (6-1)*0.8 + 1 = 5*0.8 + 1 = 5
    // (7-2)*0.8 + 2 = 5*0.8 + 2 = 6
    // (8-3)*0.8 + 3 = 5*0.8 + 3 = 7
    expect(animate(800)).toEqual([5, 6, 7]);

    // (6-1)*0.85 + 1 = 5*0.85 + 1 = 5.25
    // (7-2)*0.85 + 2 = 5*0.85 + 2 = 6.25
    // (8-3)*0.85 + 3 = 5*0.85 + 3 = 7.25
    expect(animate(850)).toEqual([5.25, 6.25, 7.25]);

    // (6-1)*0.95 + 1 = 5*0.95 + 1 = 5.75
    // (7-2)*0.95 + 2 = 5*0.95 + 2 = 6.75
    // (8-3)*0.95 + 3 = 5*0.95 + 3 = 7.75
    expect(animate(950)).toEqual([5.75, 6.75, 7.75]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*1 + 1 = 5 + 1 = 6
    // (7-2)*1 + 2 = 5 + 2 = 7
    // (8-3)*1 + 3 = 5 + 3 = 8
    expect(animate(1000)).toEqual([6, 7, 8]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*.001 + 1 = .005 + 1 = 1.005
    // (7-2)*.001 + 2 = .005 + 2 = 2.005
    // (8-3)*.001 + 3 = .005 + 3 = 3.005
    expect(animate(1001)).toEqual([1.005, 2.005, 3.005]);
  });

  it("with 2 frames and multiple MS interval from 0 to 1 sec speed of -1 (reversed animation)", () => {
    const animator = new Animate3v([
      [1, 2, 3],
      [6, 7, 8],
    ]);

    const speed = -1;
    const playback = new Playback().play().setDuration(animator.duration);
    const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed));

    // (6-1)*(0) + 1 = 5*(0) + 1 = 1
    // (7-2)*(0) + 2 = 6*(0) + 2 = 2
    // (8-3)*(0) + 3 = 7*(0) + 3 = 3
    expect(animate(0, speed)).toEqual([1, 2, 3]);

    // (6-1)*(0.5) + 1 = 5*(0.5) + 1 = 3.5
    // (7-2)*(0.5) + 2 = 5*(0.5) + 2 = 4.5
    // (8-3)*(0.5) + 3 = 5*(0.5) + 3 = 5.5
    expect(animate(500, speed)).toEqual([3.5, 4.5, 5.5]);

    // (6-1)*(0.25) + 1 = 5*(0.25) + 1 = 2.25
    // (7-2)*(0.25) + 2 = 5*(0.25) + 2 = 3.25
    // (8-3)*(0.25) + 3 = 5*(0.25) + 3 = 4.25
    expect(animate(750, speed)).toEqual([2.25, 3.25, 4.25]);

    // (6-1)*(0.15) + 1 = 5*(0.15) + 1 = 1.75
    // (7-2)*(0.15) + 2 = 5*(0.15) + 2 = 2.75
    // (8-3)*(0.15) + 3 = 5*(0.15) + 3 = 3.75
    expect(animate(850, speed)).toEqual([1.75, 2.75, 3.75]);

    // (6-1)*(1) + 1 = 5*(1) + 1 = 6
    // (7-2)*(1) + 2 = 5*(1) + 2 = 7
    // (8-3)*(1) + 3 = 5*(1) + 3 = 8
    expect(animate(1000, speed)).toEqual([6, 7, 8]);

    // (6-1)*(.999) + 1 = 5*(0.999) + 1 = 5.995
    // (7-2)*(.999) + 2 = 5*(0.999) + 2 = 6.995
    // (8-3)*(.999) + 3 = 5*(0.999) + 3 = 7.995
    expect(animate(1001, speed)).toEqual([5.995, 6.995, 7.995]);
  });
});

describe("animateScalar", () => {
  it("with varying length time intervals", () => {
    const animator = new AnimateScalar([0, 1, 2, 3], [0, 2000, 5000, 10000]);
    const playback = new Playback().play().setDuration(animator.duration);
    const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed));

    expect(animate(0)).toEqual(0);
    expect(animate(1000)).toEqual(0.5);
    expect(animate(2000)).toEqual(1);
    expect(fixed5f(animate(2500))).toEqual(1.16667);
    expect(fixed5f(animate(3000))).toEqual(1.33333);
    expect(fixed5f(animate(3500))).toEqual(1.5);
    expect(fixed5f(animate(4000))).toEqual(1.66667);
    expect(fixed5f(animate(4500))).toEqual(1.83333);
    expect(animate(5000)).toEqual(2);
    expect(animate(7500)).toEqual(2.5);
    expect(animate(10000)).toEqual(3);
  });

  describe("with 4 curve points with time range of -10 to 10 seconds, iterating 1 millisecond at a time", () => {
    const animator = new AnimateScalar([0, 1, 2, 3]);
    const frameRange = range(-10, 10, 1);
    const playback = new Playback().play().setDuration(animator.duration);
    const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed));

    it("speed of 1", () => {
      const speed = 1;
      const frames = frameRange.map((v) => animate(v, speed)).map(fixed5f);
      expect(frames).toEqual([
        2.99, 2.991, 2.992, 2.993, 2.994, 2.995, 2.996, 2.997, 2.998, 2.999, 0, 0.001, 0.002, 0.003,
        0.004, 0.005, 0.006, 0.007, 0.008, 0.009, 0.01,
      ]);
    });

    it("speed of -1 (reversed animation)", () => {
      const speed = -1;
      const frames = frameRange.map((v) => animate(v, speed)).map(fixed5f);
      expect(frames).toEqual([
        0.01, 0.009, 0.008, 0.007, 0.006, 0.005, 0.004, 0.003, 0.002, 0.001, 0, 2.999, 2.998, 2.997,
        2.996, 2.995, 2.994, 2.993, 2.992, 2.991, 2.99,
      ]);
    });
  });

  describe("frame range from 0 to 360 (degrees)", () => {
    const frames = range(0, 360);
    const times = range(0, 360);
    const animator = new AnimateScalar(frames, times);
    const playback = new Playback().play().setDuration(animator.duration);
    const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed));

    it("speed of 1", () => {
      const speed = 1;

      // This test illustrates the confusing behavior around animation looping.
      // Please see getFrameIndex for more details.
      expect(times.map((t) => animate(t, speed))).toEqual(frames);

      // At 361 seconds, we are going to render frame 2; animation produces
      // frame indexes which are 0 based index. So index 1 is the second frame.
      // We don't see rendering of frame at index 0 (frame 1).
      expect(animate(359, speed)).toEqual(359);
      expect(animate(360, speed)).toEqual(360);
      expect(animate(361, speed)).toEqual(1);
      expect(animate(362, speed)).toEqual(2);
    });

    test("speed of 2", () => {
      const speed = 2;

      // Here it looks like we are skipping two frames when we transition to the
      // new loop. Meaning that it seems like we skipped frame 0 and frame 1 and
      // instead start the new loop at frame 2.
      expect(animate(359, speed)).toEqual(358);
      expect(animate(360, speed)).toEqual(360);
      expect(animate(361, speed)).toEqual(2);
      expect(animate(362, speed)).toEqual(4);
    });
  });
});

describe("FBX animation curve values", () => {
  // FBX files animation defines a second as 46186158000. Meaning that a second
  // is 46186158000 long. Whatever that is. But you can use that to figure
  // animation times.

  const keyTimes = [
    "0",
    "1924423250",
    "3848846500",
    "5773269750",
    "7697693000",
    "9622116250",
    "11546539500",
    "13470962750",
    "15395386000",
    "17319809250",
    "19244232500",
    "21168655750",
    "23093079000",
    "25017502250",
    "26941925500",
    "28866348750",
    "30790772000",
    "32715195250",
    "34639618500",
    "36564041750",
    "38488465000",
    "40412888250",
    "42337311500",
    "44261734750",
    "46186158000",
    "48110581250",
    "50035004500",
    "51959427750",
    "53883851000",
    "55808274250",
    "57732697500",
    "59657120750",
    "61581544000",
    "63505967250",
    "65430390500",
    "67354813750",
    "69279237000",
    "71203660250",
    "73128083500",
    "75052506750",
  ].map((v) => parseInt(v));

  const frames = [
    -25, -24.534690856933594, -23.21709632873535, -21.164718627929688, -18.495054244995117,
    -15.325607299804688, -11.77387809753418, -7.957367897033691, -3.993574380874634, 0,
    3.9151315689086914, 7.680702209472656, 11.234869003295898, 14.515789985656738,
    17.461624145507812, 20.010528564453125, 22.100658416748047, 23.67017364501953,
    24.65723419189453, 25, 24.637500762939453, 23.599998474121094, 21.962501525878906,
    19.799999237060547, 17.1875, 14.200000762939453, 10.91249942779541, 7.399999618530273,
    3.737499713897705, 0, -3.7375009059906006, -7.400001525878906, -10.912500381469727,
    -14.199999809265137, -17.1875, -19.799997329711914, -21.962499618530273, -23.599998474121094,
    -24.637500762939453, -25,
  ];

  const animator = new AnimateScalar(frames, keyTimes);

  it("speed 1", () => {
    const speed = 1;
    const playback = new Playback().play().setDuration(animator.duration);
    expect(keyTimes.map((t) => animator.animate(playback.elapsed(t, speed)))).toEqual(frames);
  });

  it("speed -1 (reverse)", () => {
    const speed = -1;
    const playback = new Playback().play().setDuration(animator.duration);
    expect(keyTimes.map((t) => animator.animate(playback.elapsed(t, speed)))).toEqual(
      frames.reverse()
    );
  });
});

describe("Animation with different speeds", () => {
  const times = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const frames = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const animator = new AnimateScalar(frames, times);
  const playback = new Playback().play().setDuration(animator.duration);
  const animate = (ms, speed) => animator.animate(playback.elapsed(ms, speed), speed);

  it("speed 1", () => {
    const speed = 1;

    expect(
      range(0, 11.9, 0.1)
        .map((v) => animate(v, speed))
        .map(fixed5f)
    ).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8,
      1.9, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7,
      3.8, 3.9, 4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6,
      5.7, 5.8, 5.9, 6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7, 7.1, 7.2, 7.3, 7.4, 7.5,
      7.6, 7.7, 7.8, 7.9, 8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9, 0.1, 0.2, 0.3, 0.4,
      0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3,
      2.4, 2.5, 2.6, 2.7, 2.8, 2.9,
    ]);
  });

  it("speed 1.5", () => {
    const speed = 1.5;

    expect(
      range(0, 11.9, 0.1)
        .map((v) => animate(v, speed))
        .map(fixed5f)
    ).toEqual([
      0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4,
      2.55, 2.7, 2.85, 3, 3.15, 3.3, 3.45, 3.6, 3.75, 3.9, 4.05, 4.2, 4.35, 4.5, 4.65, 4.8, 4.95,
      5.1, 5.25, 5.4, 5.55, 5.7, 5.85, 6, 6.15, 6.3, 6.45, 6.6, 6.75, 6.9, 7.05, 7.2, 7.35, 7.5,
      7.65, 7.8, 7.95, 8.1, 8.25, 8.4, 8.55, 8.7, 8.85, 9, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05,
      1.2, 1.35, 1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4, 2.55, 2.7, 2.85, 3, 3.15, 3.3, 3.45, 3.6,
      3.75, 3.9, 4.05, 4.2, 4.35, 4.5, 4.65, 4.8, 4.95, 5.1, 5.25, 5.4, 5.55, 5.7, 5.85, 6, 6.15,
      6.3, 6.45, 6.6, 6.75, 6.9, 7.05, 7.2, 7.35, 7.5, 7.65, 7.8, 7.95, 8.1, 8.25, 8.4, 8.55, 8.7,
      8.85,
    ]);
  });

  it("speed 2", () => {
    const speed = 2;

    expect(
      range(0, 11.9, 0.1)
        .map((v) => animate(v, speed))
        .map(fixed5f)
    ).toEqual([
      0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4,
      4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8, 6, 6.2, 6.4, 6.6, 6.8, 7, 7.2, 7.4, 7.6, 7.8, 8,
      8.2, 8.4, 8.6, 8.8, 9, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3,
      3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8, 6, 6.2, 6.4, 6.6, 6.8, 7,
      7.2, 7.4, 7.6, 7.8, 8, 8.2, 8.4, 8.6, 8.8, 9, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2,
      2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8,
    ]);
  });
});
