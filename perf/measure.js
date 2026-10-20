// measureGarbage measures how much garbage run makes: the bytes the heap
// grows by each time it runs, as {bytesPerRun, collectedDuringRuns}. It
// runs run warmUpRuns times first, so that the code is optimized, and
// anything made only once, such as caches, is made, then collects the
// garbage, runs run runs times, and divides how much the heap grew by them.
//
// It measures rounds times, and keeps the round that grew the heap least.
// The garbage run makes is the same in every round, but Node now and then
// grows the heap on its own while run runs, such as by compiling run into
// faster code, which shows up in one round as garbage run didn't make.
//
// The heap's growth is only the garbage made if nothing is collected while
// run runs, so Node must run with a young generation bigger than the runs
// make, such as --min-semi-space-size=256 --max-semi-space-size=256 (see
// run.js). collectedDuringRuns says whether a collection ran anyway, which
// means the runs made more garbage than that, and bytesPerRun is too low.
import {PerformanceObserver, performance} from "node:perf_hooks";

export async function measureGarbage(run, {runs = 200, warmUpRuns = 300, rounds = 3} = {}) {
  for (let i = 0; i < warmUpRuns; i++) {
    run();
  }
  let least = null;
  for (let round = 0; round < rounds; round++) {
    const measured = await measureRound(run, runs);
    // A round with a collection reads too low, so it is only kept when
    // every round had one.
    if (
      !least ||
      (least.collectedDuringRuns && !measured.collectedDuringRuns) ||
      (least.collectedDuringRuns === measured.collectedDuringRuns &&
        measured.bytesPerRun < least.bytesPerRun)
    ) {
      least = measured;
    }
  }
  return least;
}

// measureRound collects the garbage, then runs run runs times, and measures
// how much the heap grew by each run, as measureGarbage returns it.
async function measureRound(run, runs) {
  global.gc();
  global.gc();

  const collections = [];
  const observer = new PerformanceObserver((list) => collections.push(...list.getEntries()));
  observer.observe({entryTypes: ["gc"]});
  // Reading the heap's size makes garbage itself, an object, which is
  // measured with nothing between two readings, and taken off.
  const readingBefore = process.memoryUsage().heapUsed;
  const bytesPerReading = process.memoryUsage().heapUsed - readingBefore;
  const start = performance.now();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < runs; i++) {
    run();
  }
  const after = process.memoryUsage().heapUsed;
  const end = performance.now();
  // The observer hears of collections after they happen, so it waits a
  // moment for any that ran during the runs.
  await new Promise((resolve) => setTimeout(resolve, 20));
  observer.disconnect();

  return {
    bytesPerRun: Math.max(0, after - before - bytesPerReading) / runs,
    collectedDuringRuns: collections.some(({startTime}) => startTime >= start && startTime <= end),
  };
}
