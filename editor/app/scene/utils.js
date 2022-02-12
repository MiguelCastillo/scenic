
// normalizeLeadingZero ensure that form inputs of type `number` produce
// numbers that are OK for regular math operations. E.g. many leading zeros
// are not good. Number form inputs also allow you to enter more than negative
// sign, so we gotta make sure we normalize those as well.
//
// 123.456 where 123 is the while number, followed by a decimal point,
// follwed by decimals.
//
// See unit tests for the tings normalizeLeadingZero handles and fixes.
export function normalizeLeadingZero(value) {
  if (value === "0" || !value) {
    return "0";
  }

  let [_, negativeNumber="", whole, decimalPoint, decimal] = value.match(/^(?:(-)?-*)(\d+)(?:(\.)(\d+))?$/);

  if (!whole) {
    return _buildNumber(negativeNumber, "0", decimalPoint, decimal);
  }

  let index = 0;
  while (index < whole.length && whole[index] === "0") {
    index++;
  }

  whole = whole.substr(index) || "0";
  if (whole === "0" && !decimalPoint) {
    return negativeNumber + "0";
  }

  const result = _buildNumber(negativeNumber, whole, decimalPoint, decimal);
  return result;
}

function _buildNumber(negativeNumber, whole, decimalPoint, decimal) {
  return [negativeNumber, whole, decimalPoint, decimal].filter(Boolean).join("");
}
