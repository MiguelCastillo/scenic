// versionedURL is url, a file's URL, such as "/resources/obj/flame.obj" or a
// full one, asked for at version, such as "bubble-squadron.3f9a2c41d0", the
// version of everything a game uses: with it as the URL's "v", so that the
// server lets browsers keep the file for good, since a file that changes
// gives its game a new version, and so a new URL (see bin/version-games.js
// and files.js in server/src). Without a version, or for a blob, such as a
// file picked in the editor, it is url as it is.
export function versionedURL(url, version) {
  if (!version || url.startsWith("blob:")) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}
