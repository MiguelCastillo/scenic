import {fillFromModels, metaFileOf} from "./model-meta.js";

const rockMeta = {
  generator: "bin/generate-rock.js",
  colliders: [{name: "top", shape: "cylinder", radius: 200, height: 220, position: [0, 110, 0]}],
};
const treeMeta = {generator: "bin/generate-tree.js", skeleton: [{points: [[0, 0, 0]], radii: [5]}]};

describe("fillFromModels", () => {
  const realFetch = global.fetch;
  let fetched;
  beforeEach(() => {
    fetched = [];
    global.fetch = jest.fn(async (url) => {
      fetched.push(url);
      const meta = {
        "http://localhost/resources/obj/rock.meta.json?v=game.1": rockMeta,
        "http://localhost/resources/obj/tree.meta.json?v=game.1": treeMeta,
      }[url];
      return {ok: !!meta, status: meta ? 200 : 404, json: async () => meta};
    });
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  const options = {baseURL: "http://localhost/games/hops.json", version: "game.1"};

  test("fills colliders and skeletons from their models, once per model", async () => {
    const config = {
      items: [
        {
          name: "rock",
          items: [
            {name: "rock model", type: "static-mesh", resource: "/resources/obj/rock.obj"},
            {
              name: "rock top",
              collider: {model: "/resources/obj/rock.obj", name: "top", perch: true},
            },
            {name: "rock top again", collider: {model: "/resources/obj/rock.obj", name: "top"}},
          ],
        },
        {name: "tree", skeleton: {model: "/resources/obj/tree.obj"}},
      ],
    };
    const filled = await fillFromModels(config, options);

    const [rock, tree] = filled.items;
    expect(rock.items[1].collider).toEqual({
      model: "/resources/obj/rock.obj",
      name: "top",
      perch: true,
      shape: "cylinder",
      radius: 200,
      height: 220,
    });
    expect(rock.items[1].transform.position).toEqual([0, 110, 0]);
    expect(rock.items[0]).toEqual(config.items[0].items[0]);
    expect(tree.skeleton).toEqual(treeMeta.skeleton);
    expect(fetched).toHaveLength(2);
    expect(config.items[1].skeleton).toEqual({model: "/resources/obj/tree.obj"});
  });

  test("rejects a collider its model doesn't have", async () => {
    const config = {
      items: [{name: "rock side", collider: {model: "/resources/obj/rock.obj", name: "side"}}],
    };
    await expect(fillFromModels(config, options)).rejects.toThrow('collider "side"');
  });

  test("rejects a model without a meta file", async () => {
    const config = {
      items: [{name: "cube", collider: {model: "/resources/obj/cube.obj", name: "top"}}],
    };
    await expect(fillFromModels(config, options)).rejects.toThrow("cube.meta.json: 404");
  });

  test("names a model's meta file beside it", () => {
    expect(metaFileOf("/resources/obj/rock-boulder.obj")).toBe(
      "/resources/obj/rock-boulder.meta.json"
    );
    expect(metaFileOf("/resources/fbx/ant.fbx")).toBe("/resources/fbx/ant.meta.json");
  });
});
