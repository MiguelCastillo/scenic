import {vec3, angles} from "@scenic/math";
import {createTargetFinder} from "./target.js";

// createThirdPersonBehavior keeps a camera behind a node in the scene, such as
// a character, and follows it as it moves and turns. The mouse orbits around
// the node from there, and scrolling zooms in and out. The camera cannot move
// on its own, so setMovement does nothing. getCamera returns the camera to
// place, so the behavior always follows the viewport's active camera.
//
// The camera orbits a pivot: the target node's position plus an offset in
// world coordinates, so that it can circle a character's chest rather than
// its hips. The orbit is relative to the way the target faces, so when the
// target turns, the camera swings around with it to stay behind. Only the
// target's heading counts, its turn around the world's up axis, so the camera
// stays level when the target leans or tilts. The target's front is its local
// +Z axis. The camera does not snap to the target's heading: it catches up
// over followTime, so a quick turn swings the view around smoothly.
//
// The orbit is a rotation of [pitch, yaw] in degrees. A yaw of 0 is directly
// behind the target, and the pitch has the same meaning as a free-fly camera's:
// a negative pitch looks down. The camera looks at the pivot from that
// direction, at its distance. Every frame, the camera's transform is written
// to the state manager.
//
// Its settings come from "thirdPerson" in the "camera" block of the camera's
// node in the scene config:
// - target: the node to orbit and follow, such as a character's hips bone, as
//   {"nodeID": ..., "boneName": ...} (see target.js).
// - offset: where the pivot is relative to the target's position, in world
//   coordinates, as [x, y, z].
// - distance: how far the camera starts from the pivot, in scene units.
// - minDistance and maxDistance: how close and how far zooming can go.
// - rotation: the orbit it starts with, as [pitch, yaw] in degrees, relative
//   to behind the target. [-15, 0] is behind and a little above it.
// - maxPitch: how far above or below the target it can orbit, in degrees.
// - followTime: how quickly the camera catches up when the target turns, in
//   seconds. After followTime it has closed about two thirds of the gap, and
//   it keeps closing the rest the same way. 0 keeps it exactly behind.
// - lookUp: how far the camera tilts its view up from looking at the pivot,
//   in degrees, without moving. It puts the target lower in the view and
//   shows more of what is ahead of it, like looking out of the target's
//   cockpit from behind it. Optional, 0 by default, which looks right at the
//   pivot.
export function createThirdPersonBehavior(sceneManager, getCamera) {
  const getSettings = () => sceneManager.getNodeStateByID(getCamera().id).camera.thirdPerson;

  const findTarget = createTargetFinder(sceneManager);

  // The orbit and distance start from the settings, so a newly created
  // behavior starts from the same place every time.
  let orbit = [...getSettings().rotation];
  let distance = getSettings().distance;

  // The heading the camera is at, which trails the target's heading by
  // followTime. It starts at the target's heading on the first update, so
  // the camera starts behind the target instead of swinging around to it.
  let heading = null;

  // turn orbits around the target, with the same signs as free-fly: a positive
  // rightDegrees turns the view right and a positive upDegrees looks up, which
  // moves the camera down.
  function turn(rightDegrees, upDegrees) {
    const {maxPitch} = getSettings();
    const [pitch, yaw] = orbit;
    orbit = [Math.max(-maxPitch, Math.min(maxPitch, pitch + upDegrees)), yaw - rightDegrees];
  }

  // move zooms: a positive forwardDistance moves the camera closer to the
  // target, and a negative one moves it away. Moving sideways or up does
  // nothing, since the camera always looks at the target.
  function move(forwardDistance) {
    const {minDistance, maxDistance} = getSettings();
    distance = Math.max(minDistance, Math.min(maxDistance, distance - forwardDistance));
  }

  function setMovement() {}

  function update(seconds) {
    const node = findTarget(getSettings().target);
    if (!node) {
      return;
    }

    // Matrix4 data is row-major, so the target's position is the last column
    // and its front, its local +Z axis, is the third.
    const m = node.worldMatrix.data;
    const pivot = vec3.add([m[3], m[7], m[11]], getSettings().offset);

    // The target's heading is the yaw of a camera looking the way the target
    // faces, from the target's front flattened onto the ground. A camera with
    // yaw y looks along [-sin(y), 0, -cos(y)]. When the target faces straight
    // up or down it has no heading, so the camera keeps its own.
    const [frontX, frontZ] = [m[2], m[10]];
    if (Math.hypot(frontX, frontZ) > 1e-6) {
      const targetHeading = angles.radToDeg(Math.atan2(-frontX, -frontZ));

      if (heading === null) {
        heading = targetHeading;
      } else {
        // Close part of the gap every frame. Closing 1 - e^(-t / followTime)
        // of it after t seconds is the same however the time is split into
        // frames, so the camera catches up at the same speed at any frame
        // rate. The gap is the shorter way around, between -180 and 180.
        const {followTime} = getSettings();
        const gap = ((((targetHeading - heading) % 360) + 540) % 360) - 180;
        const catchUp = followTime > 0 ? 1 - Math.exp(-seconds / followTime) : 1;
        heading += gap * catchUp;
      }
    }

    if (heading === null) {
      return;
    }

    // The direction from the camera to the pivot: the camera's local forward
    // [0, 0, -1] turned by the orbit's pitch and by its yaw on top of the
    // heading. The camera sits that far behind the pivot. It looks at the
    // pivot, tilted up by lookUp.
    const [pitch, yaw] = [orbit[0], heading + orbit[1]].map(angles.degToRad);
    const forward = [
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ];
    const position = vec3.add(
      pivot,
      forward.map((v) => -v * distance)
    );

    const rotation = [orbit[0] + (getSettings().lookUp || 0), heading + orbit[1], 0];

    const {transform} = sceneManager.getNodeStateByID(getCamera().id);
    sceneManager.updateNodeStateByID(getCamera().id, {
      transform: {...transform, position, rotation},
    });
  }

  return {turn, move, setMovement, update};
}
