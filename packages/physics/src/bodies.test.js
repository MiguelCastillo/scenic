import {stepBodies} from "./bodies.js";

// sceneWith returns a stand-in for a SceneManager holding states, a node
// state by id, with each node's parent named by parents.
function sceneWith(states, parents = {}) {
  const nodes = {};
  const nodeOf = (id) => (nodes[id] ??= {id, parent: parents[id] ? nodeOf(parents[id]) : null});
  return {
    stateManager: {getAllItemsByName: () => states},
    getNodeByID: nodeOf,
    getNodeStateByID: (id) => states[id],
    updateNodeStateByID: (id, change) => {
      states[id] = {...states[id], ...change};
    },
  };
}

describe("stepBodies", () => {
  test("moves bodies under the nearest gravity, and leaves the rest", () => {
    const states = {
      world: {gravity: [0, -10, 0]},
      ball: {
        transform: {position: [0, 100, 0]},
        body: {mass: 1, velocity: [2, 0, 0]},
      },
      rock: {transform: {position: [5, 0, 0]}},
    };
    const scene = sceneWith(states, {ball: "world", rock: "world"});
    stepBodies(scene, 1);
    expect(states.ball.body.velocity).toEqual([2, -10, 0]);
    expect(states.ball.transform.position).toEqual([2, 95, 0]);
    expect(states.rock.transform.position).toEqual([5, 0, 0]);
  });

  test("doesn't pull a body without gravity above it", () => {
    const states = {ball: {transform: {position: [0, 0, 0]}, body: {mass: 1}}};
    stepBodies(sceneWith(states), 1);
    expect(states.ball.transform.position).toEqual([0, 0, 0]);
  });

  test("moves nothing in a frame without time, such as while paused", () => {
    const states = {
      world: {gravity: [0, -10, 0]},
      ball: {transform: {position: [0, 0, 0]}, body: {mass: 1}},
    };
    stepBodies(sceneWith(states, {ball: "world"}), 0);
    expect(states.ball.transform.position).toEqual([0, 0, 0]);
  });
});
