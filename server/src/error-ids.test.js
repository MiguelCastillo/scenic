import {newErrorID} from "./error-ids.js";

describe("newErrorID", () => {
  test("is two groups of four characters easy to read out, new each time", () => {
    const ids = Array.from({length: 1000}, newErrorID);
    ids.forEach((id) => expect(id).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
