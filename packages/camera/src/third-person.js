import {vec3, angles} from "@scenic/math";
import {findTarget} from "./target.js";

// thirdPerson keeps a "third-person-camera" behind a node in the scene, such
// as a character, and follows it as it moves and turns. The mouse orbits
// around the node from there, and scrolling zooms in and out. The camera
// cannot move on its own, so setMovement does nothing. It keeps nothing
// itself: it reads the camera's state and writes back to it.
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
// Its settings are the camera's "thirdPerson" block:
// - target: the node to orbit and follow, such as a character's hips bone, as
//   {"nodeID": ..., "boneName": ...} (see target.js).
// - offset: where the pivot is relative to the target's position, in world
//   coordinates, as [x, y, z].
// - distance: how far the camera is from the pivot, in scene units. Zooming
//   changes it.
// - minDistance and maxDistance: how close and how far zooming can go.
// - rotation: the orbit, as [pitch, yaw] in degrees, relative to behind the
//   target. [-15, 0] is behind and a little above it. Orbiting changes it.
// - maxPitch: how far above or below the target it can orbit, in degrees.
// - followTime: how quickly the camera catches up when the target turns, in
//   seconds. After followTime it has closed about two thirds of the gap, and
//   it keeps closing the rest the same way. 0 keeps it exactly behind.
// - lookUp: how far the camera tilts its view up from looking at the pivot,
//   in degrees, without moving. It puts the target lower in the view and
//   shows more of what is ahead of it, like looking out of the target's
//   cockpit from behind it. Optional, 0 by default, which looks right at the
//   pivot.
// - heading: the heading the camera is at, in degrees, which trails the
//   target's heading by followTime. Optional; without it, the camera starts
//   at the target's heading, behind it, instead of swinging around to it.
export const thirdPerson = {
  stateKey: "thirdPerson",

  // turn orbits around the target, with the same signs as free-fly: a positive
  // rightDegrees turns the view right and a positive upDegrees looks up, which
  // moves the camera down.
  turn(sceneManager, camera, rightDegrees, upDegrees) {
    const {thirdPerson} = sceneManager.getNodeStateByID(camera.id);
    const {
      maxPitch,
      rotation: [pitch, yaw],
    } = thirdPerson;
    const rotation = [
      Math.max(-maxPitch, Math.min(maxPitch, pitch + upDegrees)),
      yaw - rightDegrees,
    ];
    sceneManager.updateNodeStateByID(camera.id, {thirdPerson: {...thirdPerson, rotation}});
  },

  // move zooms: a positive forwardDistance moves the camera closer to the
  // target, and a negative one moves it away. Moving sideways or up does
  // nothing, since the camera always looks at the target.
  move(sceneManager, camera, forwardDistance) {
    const {thirdPerson} = sceneManager.getNodeStateByID(camera.id);
    const {minDistance, maxDistance} = thirdPerson;
    const distance = Math.max(
      minDistance,
      Math.min(maxDistance, thirdPerson.distance - forwardDistance)
    );
    sceneManager.updateNodeStateByID(camera.id, {thirdPerson: {...thirdPerson, distance}});
  },

  setMovement() {},

  update(sceneManager, camera, seconds) {
    const {transform, thirdPerson} = sceneManager.getNodeStateByID(camera.id);
    const node = findTarget(sceneManager, thirdPerson.target);
    if (!node) {
      return;
    }

    // Matrix4 data is row-major, so the target's position is the last column
    // and its front, its local +Z axis, is the third.
    const m = node.worldMatrix.data;
    const pivot = vec3.add([m[3], m[7], m[11]], thirdPerson.offset);

    // The target's heading is the yaw of a camera looking the way the target
    // faces, from the target's front flattened onto the ground. A camera with
    // yaw y looks along [-sin(y), 0, -cos(y)]. When the target faces straight
    // up or down it has no heading, so the camera keeps its own.
    let {heading} = thirdPerson;
    const [frontX, frontZ] = [m[2], m[10]];
    if (Math.hypot(frontX, frontZ) > 1e-6) {
      const targetHeading = angles.radToDeg(Math.atan2(-frontX, -frontZ));

      if (heading == null) {
        heading = targetHeading;
      } else {
        // Close part of the gap every frame. Closing 1 - e^(-t / followTime)
        // of it after t seconds is the same however the time is split into
        // frames, so the camera catches up at the same speed at any frame
        // rate. The gap is the shorter way around, between -180 and 180.
        const {followTime} = thirdPerson;
        const gap = ((((targetHeading - heading) % 360) + 540) % 360) - 180;
        const catchUp = followTime > 0 ? 1 - Math.exp(-seconds / followTime) : 1;
        heading += gap * catchUp;
      }
    }

    if (heading == null) {
      return;
    }

    // The direction from the camera to the pivot: the camera's local forward
    // [0, 0, -1] turned by the orbit's pitch and by its yaw on top of the
    // heading. The camera sits that far behind the pivot. It looks at the
    // pivot, tilted up by lookUp.
    const {rotation: orbit, distance, lookUp = 0} = thirdPerson;
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

    sceneManager.updateNodeStateByID(camera.id, {
      transform: {...transform, position, rotation: [orbit[0] + lookUp, heading + orbit[1], 0]},
      thirdPerson: {...thirdPerson, heading},
    });
  },

  // reset is state, the camera's "thirdPerson" block, with the orbit, zoom
  // and heading put back to originalState's, the block in the scene config,
  // so the camera goes back behind the target.
  reset(state, originalState) {
    const {rotation, distance, heading} = originalState;
    return {...state, rotation, distance, heading};
  },
};
