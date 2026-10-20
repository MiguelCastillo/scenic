// run measures the garbage the engine's hot path makes, and the WebGL calls
// it makes (see "Best practices for the hot path" in the README), and fails
// when any of it is over its budget, so that a change that undoes the work
// to make few is caught:
//
//   npm run perf
//
// It measures garbage, in bytes, and calls, rather than time: the same code
// makes the same garbage and the same calls on every run, on any machine,
// so a budget can be close to what is measured, where a time would change
// with the machine and what else it is doing.
//
// Each file listed in caseFiles exports cases, each as {name, per,
// budgetBytes, setUp}: what it measures, what one run is, such as a
// "frame", the most garbage one run may make, and a function that sets the
// case up and returns the function to run. A case that counts WebGL calls
// instead is {name, per, budgetCalls, countCalls}: the most calls one run
// may make, and a function that makes one run and returns how many calls it
// made (see stand-in-gl.js).
//
// A garbage budget is about twice what was measured when it was set, so
// that small changes don't trip it, or, for code that makes none, a little
// over nothing. A calls budget is what was measured, since calls are exact.
// A change that lowers what a case makes, on purpose, lowers its budget
// too, and one that adds calls on purpose raises it, saying why.
//
// Before any case, it checks that it measures right, by measuring something
// whose size is known, and stops if it doesn't: a measure that reads 0 for
// everything would pass every budget.
import {measureGarbage} from "./measure.js";

const caseFiles = ["./shader-program.js", "./mesh.js", "./arrays.js"];

// The check: checkObjectCount objects of two fields, which take
// bytesPerObject each on 64 bit Node, and half that with compressed
// pointers.
const checkObjectCount = 1000;
const bytesPerObject = 40;

if (typeof global.gc !== "function") {
  console.error(
    "perf needs Node's flags, from package.json: run it with npm run perf, not node perf/run.js"
  );
  process.exit(1);
}

// formatSize writes bytes as people read them: in bytes under a kilobyte,
// and in kilobytes above.
const formatSize = (bytes) =>
  bytes < 1000 ? `${bytes.toFixed(1)} B` : `${(bytes / 1000).toFixed(1)} KB`;
const rows = [];
let anyOverBudget = false;

// Checks that it measures right, before any case.
const checkObjects = [];
const checkMeasurement = await measureGarbage(
  () => {
    for (let i = 0; i < checkObjectCount; i++) {
      checkObjects[i] = {first: i, second: i};
    }
  },
  {runs: 20}
);
const expectedBytes = checkObjectCount * bytesPerObject;
if (
  checkMeasurement.collectedDuringRuns ||
  checkMeasurement.bytesPerRun < expectedBytes / 2 ||
  checkMeasurement.bytesPerRun > expectedBytes * 1.25
) {
  console.error(
    `perf doesn't measure right: ${checkObjectCount} objects of two fields measured ` +
      `${formatSize(checkMeasurement.bytesPerRun)}, not about ${formatSize(expectedBytes)}` +
      (checkMeasurement.collectedDuringRuns ? ", with a collection during the runs" : "")
  );
  process.exit(1);
}
rows.push([
  `Check: ${checkObjectCount} objects of two fields`,
  formatSize(checkMeasurement.bytesPerRun),
  formatSize(expectedBytes),
  "ok",
]);

for (const file of caseFiles) {
  const {cases} = await import(file);
  for (const {name, per, budgetBytes, setUp, budgetCalls, countCalls} of cases) {
    if (countCalls) {
      const calls = countCalls();
      const overBudget = calls > budgetCalls;
      anyOverBudget ||= overBudget;
      rows.push([
        `${name}, a ${per}`,
        `${calls} calls`,
        `${budgetCalls} calls`,
        overBudget ? "OVER BUDGET" : "ok",
      ]);
      continue;
    }
    const {bytesPerRun, collectedDuringRuns} = await measureGarbage(setUp());
    const overBudget = collectedDuringRuns || bytesPerRun > budgetBytes;
    anyOverBudget ||= overBudget;
    rows.push([
      `${name}, a ${per}`,
      collectedDuringRuns ? `over ${formatSize(bytesPerRun)}` : formatSize(bytesPerRun),
      formatSize(budgetBytes),
      overBudget ? "OVER BUDGET" : "ok",
    ]);
  }
}

const header = ["What it makes", "Measured", "Budget", ""];
const widths = header.map((_, column) =>
  Math.max(...[header, ...rows].map((row) => row[column].length))
);
const formatRow = (row) =>
  row
    .map((cell, column) => cell.padEnd(widths[column]))
    .join("  ")
    .trimEnd();
console.log(`Measured in Node ${process.version}\n`);
console.log(formatRow(header));
rows.forEach((row) => console.log(formatRow(row)));
if (anyOverBudget) {
  console.log(
    '\nSomething is over its budget: see "Best practices for the hot path" in the README.'
  );
  process.exit(1);
}
