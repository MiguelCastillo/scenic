import {animate2v, animate3v, animateScalar} from "./keyframe.js";
import {range} from "../math/range.js";
import {fixed5f} from "../math/float.js";

// Let's disable console log to keep the reports clean.
jest.spyOn(console, "log").mockImplementation(() => {});

describe("animate2v", () => {
  it("no frames does not throw error", () => {
    expect(() => {
      animate2v([]);
    }).not.toThrow();
  });

  it("with 1 frame does not throw error", () => {
    expect(() => {
      animate2v([[6, 7]]);
    }).not.toThrow();
  });

  it("with 2 frames and multiple MS interval from 0 to 1 sec", () => {
    const animator = animate2v([
      [1, 2],
      [6, 7],
    ]);

    // (6-1)*0 + 1 = 0 + 1 = 1
    // (7-2)*0 + 2 = 0 + 2 = 2
    expect(animator(0)).toEqual([1, 2]);

    // (6-1)*0.5 + 1 = 5*0.5 + 1 = 3.5
    // (7-2)*0.5 + 2 = 5*0.5 + 2 = 4.5
    expect(animator(500)).toEqual([3.5, 4.5]);

    // (6-1)*0.55 + 1 = 5*0.55 + 1 = 3.75
    // (7-2)*0.55 + 2 = 5*0.55 + 2 = 4.75
    expect(animator(550)).toEqual([3.75, 4.75]);

    // (6-1)*0.6 + 1 = 5*0.6 + 1 = 4
    // (7-2)*0.6 + 2 = 5*0.6 + 2 = 5
    expect(animator(600)).toEqual([4, 5]);

    // (6-1)*0.65 + 1 = 5*0.65 + 1 = 4.25
    // (7-2)*0.65 + 2 = 5*0.65 + 2 = 5.25
    expect(animator(650)).toEqual([4.25, 5.25]);

    // (6-1)*0.7 + 1 = 5*0.7 + 1 = 4.5
    // (7-2)*0.7 + 2 = 5*0.7 + 2 = 5.5
    expect(animator(700)).toEqual([4.5, 5.5]);

    // (6-1)*0.75 + 1 = 5*0.75 + 1 = 4.75
    // (7-2)*0.75 + 2 = 5*0.75 + 2 = 5.75
    expect(animator(750)).toEqual([4.75, 5.75]);

    // (6-1)*0.8 + 1 = 5*0.8 + 1 = 5
    // (7-2)*0.8 + 2 = 5*0.8 + 2 = 6
    expect(animator(800)).toEqual([5, 6]);

    // (6-1)*0.85 + 1 = 5*0.85 + 1 = 5.25
    // (7-2)*0.85 + 2 = 5*0.85 + 2 = 6.25
    expect(animator(850)).toEqual([5.25, 6.25]);

    // (6-1)*0.95 + 1 = 5*0.95 + 1 = 5.75
    // (7-2)*0.95 + 2 = 5*0.95 + 2 = 6.75
    expect(animator(950)).toEqual([5.75, 6.75]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*1 + 1 = 5 + 1 = 6
    // (7-2)*1 + 2 = 5 + 2 = 7
    expect(animator(1000)).toEqual([6, 7]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*.001 + 1 = .005 + 1 = 1.005
    // (7-2)*.001 + 2 = .005 + 2 = 2.005
    expect(animator(1001)).toEqual([1.005, 2.005]);
  });
});

describe("animate3v", () => {
  it("with no frames does not throw error", () => {
    expect(() => {
      animate3v([]);
    }).not.toThrow();
  });

  it("with 1 frame does not throw error", () => {
    expect(() => {
      animate3v([[6, 7, 8]]);
    }).not.toThrow();
  });

  it("with 2 frames and multiple MS interval from 0 to 1 sec", () => {
    const animator = animate3v([
      [1, 2, 3],
      [6, 7, 8],
    ]);

    // (6-1)*0 + 1 = 0 + 1 = 1
    // (7-2)*0 + 2 = 0 + 2 = 2
    // (8-3)*0 + 3 = 0 + 3 = 3
    expect(animator(0)).toEqual([1, 2, 3]);

    // (6-1)*0.5 + 1 = 5*0.5 + 1 = 3.5
    // (7-2)*0.5 + 2 = 5*0.5 + 2 = 4.5
    // (8-3)*0.5 + 3 = 5*0.5 + 3 = 5.5
    expect(animator(500)).toEqual([3.5, 4.5, 5.5]);

    // (6-1)*0.55 + 1 = 5*0.55 + 1 = 3.75
    // (7-2)*0.55 + 2 = 5*0.55 + 2 = 4.75
    // (8-3)*0.55 + 3 = 5*0.55 + 3 = 5.75
    expect(animator(550)).toEqual([3.75, 4.75, 5.75]);

    // (6-1)*0.6 + 1 = 5*0.6 + 1 = 4
    // (7-2)*0.6 + 2 = 5*0.6 + 2 = 5
    // (8-3)*0.6 + 3 = 5*0.6 + 3 = 6
    expect(animator(600)).toEqual([4, 5, 6]);

    // (6-1)*0.65 + 1 = 5*0.65 + 1 = 4.25
    // (7-2)*0.65 + 2 = 5*0.65 + 2 = 5.25
    // (8-3)*0.65 + 3 = 5*0.65 + 3 = 6.25
    expect(animator(650)).toEqual([4.25, 5.25, 6.25]);

    // (6-1)*0.7 + 1 = 5*0.7 + 1 = 4.5
    // (7-2)*0.7 + 2 = 5*0.7 + 2 = 5.5
    // (8-3)*0.7 + 3 = 5*0.7 + 3 = 6.5
    expect(animator(700)).toEqual([4.5, 5.5, 6.5]);

    // (6-1)*0.75 + 1 = 5*0.75 + 1 = 4.75
    // (7-2)*0.75 + 2 = 5*0.75 + 2 = 5.75
    // (8-3)*0.75 + 3 = 5*0.75 + 3 = 6.75
    expect(animator(750)).toEqual([4.75, 5.75, 6.75]);

    // (6-1)*0.8 + 1 = 5*0.8 + 1 = 5
    // (7-2)*0.8 + 2 = 5*0.8 + 2 = 6
    // (8-3)*0.8 + 3 = 5*0.8 + 3 = 7
    expect(animator(800)).toEqual([5, 6, 7]);

    // (6-1)*0.85 + 1 = 5*0.85 + 1 = 5.25
    // (7-2)*0.85 + 2 = 5*0.85 + 2 = 6.25
    // (8-3)*0.85 + 3 = 5*0.85 + 3 = 7.25
    expect(animator(850)).toEqual([5.25, 6.25, 7.25]);

    // (6-1)*0.95 + 1 = 5*0.95 + 1 = 5.75
    // (7-2)*0.95 + 2 = 5*0.95 + 2 = 6.75
    // (8-3)*0.95 + 3 = 5*0.95 + 3 = 7.75
    expect(animator(950)).toEqual([5.75, 6.75, 7.75]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*1 + 1 = 5 + 1 = 6
    // (7-2)*1 + 2 = 5 + 2 = 7
    // (8-3)*1 + 3 = 5 + 3 = 8
    expect(animator(1000)).toEqual([6, 7, 8]);

    // Every second we will start a new frame so the multiplier
    // for linear interpolation (lerp) starts at 0 again.
    // (6-1)*.001 + 1 = .005 + 1 = 1.005
    // (7-2)*.001 + 2 = .005 + 2 = 2.005
    // (8-3)*.001 + 3 = .005 + 3 = 3.005
    expect(animator(1001)).toEqual([1.005, 2.005, 3.005]);
  });

  it("with 2 frames and multiple MS interval from 0 to 1 sec speed of -1 (reversed animation)", () => {
    const animator = animate3v([
      [1, 2, 3],
      [6, 7, 8],
    ]);

    const speed = -1;

    // (6-1)*1 + 1 = 5 + 1 = 6
    // (7-2)*1 + 2 = 6 + 2 = 7
    // (8-3)*1 + 3 = 7 + 3 = 8
    expect(animator(0, speed)).toEqual([6, 7, 8]);

    // (6-1)*(0.5) + 1 = 5*(0.5) + 1 = 3.5
    // (7-2)*(0.5) + 2 = 5*(0.5) + 2 = 4.5
    // (8-3)*(0.5) + 3 = 5*(0.5) + 3 = 5.5
    expect(animator(500, speed)).toEqual([3.5, 4.5, 5.5]);

    // (6-1)*(0.25) + 1 = 5*(0.25) + 1 = 2.25
    // (7-2)*(0.25) + 2 = 5*(0.25) + 2 = 3.25
    // (8-3)*(0.25) + 3 = 5*(0.25) + 3 = 4.25
    expect(animator(750, speed)).toEqual([2.25, 3.25, 4.25]);

    // (6-1)*(0.15) + 1 = 5*(0.15) + 1 = 1.75
    // (7-2)*(0.15) + 2 = 5*(0.15) + 2 = 2.75
    // (8-3)*(0.15) + 3 = 5*(0.15) + 3 = 3.75
    expect(animator(850, speed)).toEqual([1.75, 2.75, 3.75]);

    // (6-1)*(0) + 1 = 5*(0) + 1 = 1
    // (7-2)*(0) + 2 = 5*(0) + 2 = 2
    // (8-3)*(0) + 3 = 5*(0) + 3 = 3
    expect(animator(1000, speed)).toEqual([1, 2, 3]);

    // (6-1)*(.999) + 1 = 5*(0.999) + 1 = 5.995
    // (7-2)*(.999) + 2 = 5*(0.999) + 2 = 6.995
    // (8-3)*(.999) + 3 = 5*(0.999) + 3 = 7.995
    expect(animator(1001, speed)).toEqual([5.995, 6.995, 7.995]);
  });
});

describe("animateScalar", () => {
  describe("with 4 curve points with time range of -10 to 10 seconds, iterating 1 millisecond at a time", () => {
    const animator = animateScalar([0, 1, 2, 3]);
    const frameRange = range(-10000, 10000, 1);

    const getFrameValue = (v) => {
      // Tricky end of frame values. This is just reference to help illustrate
      // what values to expect and their relationship to each other.
      // 3000/1000  = 3    // 3/3   = 1  // 3 frame value
      // 6000/1000  = 6    // 6/3   = 2  // 3 frame value
      // 9000/1000  = 9    // 9/3   = 3  // 3 frame value
      // 12000/1000 = 12   // 12/3  = 4  // 3 frame value
      let expected = Math.abs((v * 0.001) % 3);
      return !expected && v ? 3 : expected;
    };

    it("speed of 1", () => {
      const speed = 1;

      const frames = frameRange.map((v) => animator(v, speed)).map(fixed5f);

      const expected = frameRange.map(getFrameValue).map(fixed5f);

      expect(frames).toEqual(expected);
    });

    it("speed of -1 (reversed animation)", () => {
      const speed = -1;

      const frames = frameRange.map((v) => animator(v, speed)).map(fixed5f);

      const expected = frameRange.map(getFrameValue).map((v) => fixed5f(3 - v));

      expect(frames).toEqual(expected);
    });
  });

  describe("with 4 curve points in a 3 second animation", () => {
    const frames = [0, 1, 2, 3];
    const animator = animateScalar(frames);

    it("speed 1", () => {
      const speed = 1;
      expect(animator(0, speed)).toEqual(0);
      expect(animator(250, speed)).toEqual(0.25);
      expect(animator(500, speed)).toEqual(0.5);
      expect(animator(750, speed)).toEqual(0.75);
      expect(animator(1000, speed)).toEqual(1);
      expect(animator(1250, speed)).toEqual(1.25);
      expect(animator(1500, speed)).toEqual(1.5);
      expect(animator(1750, speed)).toEqual(1.75);
      expect(animator(2000, speed)).toEqual(2);
      expect(animator(2250, speed)).toEqual(2.25);
      expect(animator(2500, speed)).toEqual(2.5);
      expect(animator(2750, speed)).toEqual(2.75);
      expect(animator(3000, speed)).toEqual(3);
      expect(animator(3001, speed)).toEqual(0.001);
      expect(animator(3002, speed)).toEqual(0.002);
    });

    it("speed of -1 (reversed animation)", () => {
      const speed = -1;
      expect(animator(0, speed)).toEqual(3);
      expect(animator(250, speed)).toEqual(2.75);
      expect(animator(500, speed)).toEqual(2.5);
      expect(animator(750, speed)).toEqual(2.25);
      expect(animator(1000, speed)).toEqual(2);
      expect(animator(1250, speed)).toEqual(1.75);
      expect(animator(1500, speed)).toEqual(1.5);
      expect(animator(1750, speed)).toEqual(1.25);
      expect(animator(2000, speed)).toEqual(1);
      expect(animator(2250, speed)).toEqual(0.75);
      expect(animator(2500, speed)).toEqual(0.5);
      expect(animator(2750, speed)).toEqual(0.25);
      expect(animator(3000, speed)).toEqual(0);
      expect(animator(3001, speed)).toEqual(2.999);
      expect(animator(3002, speed)).toEqual(2.998);
    });
  });

  describe("frame range from 0 to 360 (degrees)", () => {
    const frames = range(0, 360);
    const times = range(0, 360);
    const animator = animateScalar(frames, times);

    it("speed of 1", () => {
      const speed = 1;

      // This test illustrates the confusing behavior around animation looping.
      // Please see getFrameIndex for more details.
      expect(times.map((t) => animator(t, speed))).toEqual(frames);

      // At 361 seconds, we are going to render frame 2; animation produces
      // frame indexes which are 0 based index. So index 1 is the second frame.
      // We don't see rendering of frame at index 0 (frame 1).
      expect(animator(360, speed)).toEqual(360);
      expect(animator(361, speed)).toEqual(1);
      expect(animator(362, speed)).toEqual(2);
    });

    test("speed of 2", () => {
      const speed = 2;

      // Here it looks like we are skipping two frames when we transition to the
      // new loop. Meaning that it seems like we skipped frame 0 and frame 1 and
      // instead start the new loop at frame 2.
      expect(animator(360, speed)).toEqual(360);
      expect(animator(361, speed)).toEqual(2);
      expect(animator(362, speed)).toEqual(4);
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

  const animator = animateScalar(frames, keyTimes);

  test("speed 1", () => {
    const speed = 1;
    expect(keyTimes.map((t) => animator(t, speed))).toEqual(frames);
  });

  test("speed -1 (reverse)", () => {
    const speed = -1;
    expect(keyTimes.map((t) => animator(t, speed))).toEqual(frames.reverse());
  });
});
