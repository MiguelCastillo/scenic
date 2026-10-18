import {randomInt} from "node:crypto";

// The characters error ids are made of: capitals and digits, without I, O,
// 0 and 1, which look alike when read out.
const idCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// newErrorID is an id for one time something went wrong, such as
// "7F3K-Q2MD", which the server logs with what happened and tells whoever
// it went wrong for, so that what they report can be found in the logs.
export function newErrorID() {
  const part = () => Array.from({length: 4}, () => idCharacters[randomInt(32)]).join("");
  return `${part()}-${part()}`;
}
