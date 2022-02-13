import {normalizeLeadingZero} from "./utils";

describe("normalizeLeadingZero", () => {
  it("value is zero", () => {
    expect(normalizeLeadingZero("0")).toEqual("0");
  });
  it("-0", () => {
    expect(normalizeLeadingZero("-0")).toEqual("-0")
  });
  it("with no whole number with decimal point", () => {
    expect(normalizeLeadingZero(".345")).toEqual("0.345")
  });
  it("value is multiple zeros", () => {
    expect(normalizeLeadingZero("0000")).toEqual("0");
  });
  it("value is leading zeros", () => {
    expect(normalizeLeadingZero("00001")).toEqual("1");
  });
  it("value is NO leading zeros", () => {
    expect(normalizeLeadingZero("1")).toEqual("1");
  });
  it("negavtive value", () => {
    expect(normalizeLeadingZero("-1")).toEqual("-1");
  });
  it("many leading negavtive symbols", () => {
    expect(normalizeLeadingZero("---1")).toEqual("-1");
  });
  it("many leading negavtive symbols with leading zeros", () => {
    expect(normalizeLeadingZero("---0001")).toEqual("-1");
  });
  it("many leading negavtive symbols with only zeros", () => {
    expect(normalizeLeadingZero("---000")).toEqual("-0");
  });
  it("negavtive decimal number with leading 0s", () => {
    expect(normalizeLeadingZero("-0.000004325711511636084")).toEqual("-0.000004325711511636084")
  });
  it("decimal number with leading 0s", () => {
    expect(normalizeLeadingZero("0.000004325711511636084")).toEqual("0.000004325711511636084")
  });
});
