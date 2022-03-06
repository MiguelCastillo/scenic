import {Timer, Playback} from "./timer.js";

describe("Pause/Play animation", () => {
  let playback = new Playback();

  test("pausing with time ref 0", () => {
    playback.reset(0).start();
    expect(playback.elapsed(0)).toEqual(0);
    expect(playback.elapsed(100)).toEqual(100);

    playback.pause(100);
    expect(playback.elapsed(200)).toEqual(100);
    expect(playback.elapsed(300)).toEqual(100);

    playback.play(500);
    expect(playback.elapsed(500)).toEqual(100);
    expect(playback.elapsed(600)).toEqual(200);
  });

  test("pausing with time ref 100", () => {
    playback.reset(1).start();
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

test("animation timer", () => {
  let timer = new Timer();
  expect(timer.pause(0).length).toEqual(0);
  expect(timer.pause(100).length).toEqual(100);
  expect(timer.elapsed(500)).toEqual(400);
  expect(timer.elapsed(600)).toEqual(500);
  expect(timer.pause(300).length).toEqual(200);
  expect(timer.elapsed(600)).toEqual(400);
  expect(timer.elapsed(900)).toEqual(700);
});
