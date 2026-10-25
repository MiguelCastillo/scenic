import {versionedURL} from "./versioned-url.js";

// metaFileOf returns the path of a model's meta file: the model's path or
// URL with its extension replaced by ".meta.json", such as
// "/resources/obj/rock.meta.json" for "/resources/obj/rock.obj" (see "Model
// meta files" in the README).
export function metaFileOf(model) {
  return model.replace(/\.[^./]+$/, "") + ".meta.json";
}

// fillFromModels returns a copy of config, a scene's or a node's, with its
// references to models' data filled in. A node at any depth can point its
// collider or its skeleton at a model, and fillFromModels replaces that
// reference with the data from the model's meta file. That way a scene names
// a model's data instead of copying it. config itself is not changed.
//
// - A node whose "collider" has a "model" and a "name", such as {"model":
//   "/resources/obj/rock.obj", "name": "top", "perch": true}, gets the fields
//   of the meta file's collider with that name, other than its position,
//   such as its shape and radius, added to its collider. Its other fields, such as "perch", stay;
//   where both set a field, the meta file's value wins. The node's
//   transform.position is set to that collider's position in the meta file,
//   replacing any position the scene gave it.
// - A node whose "skeleton" is {"model": ...} gets the meta file's skeleton
//   in its place.
//
// It fetches each meta file once, from baseURL, at version (see
// versionedURL). It rejects when a meta file can't be fetched, or doesn't
// have the collider or skeleton a node names.
export async function fillFromModels(config, {baseURL, version = null}) {
  const metas = new Map();
  const metaOf = (model) => {
    if (!metas.has(model)) {
      const url = versionedURL(new URL(metaFileOf(model), baseURL).href, version);
      metas.set(
        model,
        fetch(url).then((response) => {
          if (!response.ok) {
            throw new Error(`unable to load ${metaFileOf(model)}: ${response.status}`);
          }
          return response.json();
        })
      );
    }
    return metas.get(model);
  };

  const fill = async (nodeConfig) => {
    const filled = {...nodeConfig};
    const {collider, skeleton} = nodeConfig;
    if (collider?.model) {
      const {colliders = []} = await metaOf(collider.model);
      const found = colliders.find(({name}) => name === collider.name);
      if (!found) {
        throw new Error(
          `"${nodeConfig.name}" names collider "${collider.name}", which ${collider.model} doesn't have`
        );
      }
      const {position, ...shape} = found;
      filled.collider = {...collider, ...shape};
      filled.transform = {...nodeConfig.transform, position};
    }
    if (skeleton?.model) {
      const meta = await metaOf(skeleton.model);
      if (!meta.skeleton) {
        throw new Error(
          `"${nodeConfig.name}" names ${skeleton.model}'s skeleton, which it doesn't have`
        );
      }
      filled.skeleton = meta.skeleton;
    }
    if (nodeConfig.items) {
      filled.items = await Promise.all(nodeConfig.items.map(fill));
    }
    return filled;
  };
  return fill(config);
}
