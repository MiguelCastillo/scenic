import {findChildDeepBreadthFirst, findChildrenDeepBreadthFirst} from "./traversal.js";

import {Node} from "./node.js";

describe("findChildDeepBreadthFirst", () => {
  const nodeTypePredicate = (x) => x instanceof Node;

  test("empty set", () => {
    const expected = findChildDeepBreadthFirst({items: []}, nodeTypePredicate);
    expect(expected).toBeUndefined();
  });

  test("with 1 child of the type to be found", () => {
    const expected = findChildDeepBreadthFirst(
      {items: [new Node({name: "only-one"})]},
      nodeTypePredicate
    );
    expect(expected).toBeDefined();
    expect(expected.name).toEqual("only-one");
  });

  test("with 3 child of the type to be found, we reutrn the 1 one", () => {
    const node = {items: [new Node({name: 1}), new Node({name: 2}), new Node({name: 3})]};

    const expected = findChildDeepBreadthFirst(node, nodeTypePredicate);
    expect(expected).toBeDefined();
    expect(expected.name).toEqual(1);
  });

  test("with 3 child and the last is the right type to found, we reutrn the 1 one", () => {
    const node = {items: ["some string", "some other string", new Node({name: "third-item!"})]};

    const expected = findChildDeepBreadthFirst(node, nodeTypePredicate);
    expect(expected).toBeDefined();
    expect(expected.name).toEqual("third-item!");
  });

  test("with nested items and the very last of them all is the correct type, we reutrn the 1 one", () => {
    const visited = [];
    const predicate = (x) => {
      visited.push(x);
      return x instanceof Node;
    };

    const node = {
      items: [
        {name: 1, items: ["l1 c1", "l1 c2", {name: 4, items: ["l4 c1", "l4 c2"]}]},
        {name: 2, items: ["l2 c1", "l2 c2"]},
        {name: 3, items: ["l3 c1", "l3 c2", new Node({name: "very-last-item"})]},
      ],
    };

    const expected = findChildDeepBreadthFirst(node, predicate);
    expect(expected).toBeDefined();
    expect(expected.name).toEqual("very-last-item");

    expect(visited[0]).toMatchObject({name: 1});
    expect(visited[1]).toMatchObject({name: 2});
    expect(visited[2]).toMatchObject({name: 3});
    expect(visited[3]).toEqual("l1 c1");
    expect(visited[4]).toEqual("l1 c2");
    expect(visited[5]).toMatchObject({name: 4});
    expect(visited[6]).toEqual("l2 c1");
    expect(visited[7]).toEqual("l2 c2");
    expect(visited[8]).toEqual("l3 c1");
    expect(visited[9]).toEqual("l3 c2");
    expect(visited[10]).toMatchObject({name: "very-last-item"});
  });

  test("with 3 layers deep nested items and the very last of them all is the correct type, we reutrn the 1 one", () => {
    const visited = [];
    const predicate = (x) => {
      visited.push(x);
      return x instanceof Node;
    };

    const node = {
      items: [
        {
          name: 1,
          items: [
            {
              name: 3,
              items: [
                "l1 c1",
                "l1 c2",
                {name: 7, items: ["l5 c1", "l5 c2", {name: 8, items: ["l6 c1", "l6 c2"]}]},
              ],
            },
            {name: 4, items: ["l2 c1", "l2 c2"]},
          ],
        },
        {
          name: 2,
          items: [
            {name: 5, items: ["l3 c1", "l3 c2", new Node({name: "the-item-i-was-looking-for"})]},
            {name: 6, items: ["l4 c1", "l4 c2"]},
          ],
        },
      ],
    };

    const expected = findChildDeepBreadthFirst(node, predicate);
    expect(expected).toBeDefined();
    expect(expected.name).toEqual("the-item-i-was-looking-for");

    expect(visited).toHaveLength(14);
    expect(visited[0]).toMatchObject({name: 1});
    expect(visited[1]).toMatchObject({name: 2});
    expect(visited[2]).toMatchObject({name: 3});
    expect(visited[3]).toMatchObject({name: 4});
    expect(visited[4]).toMatchObject({name: 5});
    expect(visited[5]).toMatchObject({name: 6});
    expect(visited[6]).toEqual("l1 c1");
    expect(visited[7]).toEqual("l1 c2");
    expect(visited[8]).toMatchObject({name: 7});
    expect(visited[9]).toEqual("l2 c1");
    expect(visited[10]).toEqual("l2 c2");
    expect(visited[11]).toEqual("l3 c1");
    expect(visited[12]).toEqual("l3 c2");
    expect(visited[13]).toMatchObject({name: "the-item-i-was-looking-for"});
  });
});

describe("findChildrenDeepBreadthFirst", () => {
  test("no items to process", () => {
    const expected = findChildrenDeepBreadthFirst({items: []}, (x) => x instanceof Node);
    expect(expected).toHaveLength(0);
  });

  test("2 no items found 10 to process", () => {
    const node = {
      items: [
        {
          name: 1,
          items: [
            {
              name: 3,
              items: [
                "l1 c1",
                "l1 c2",
                {
                  name: 7,
                  items: [
                    "l5 c1",
                    "l5 c2",
                    {
                      name: 8,
                      items: [
                        "l6 c1",
                        "l6 c2",
                        new Node({name: "the-SECOND-item-i-was-looking-for"}),
                      ],
                    },
                  ],
                },
              ],
            },
            {name: 4, items: ["l2 c1", "l2 c2"]},
          ],
        },
        {
          name: 2,
          items: [
            {
              name: 5,
              items: ["l3 c1", "l3 c2", new Node({name: "the-FIRST-item-i-was-looking-for"})],
            },
            {name: 6, items: ["l4 c1", "l4 c2"]},
          ],
        },
      ],
    };

    const expected = findChildrenDeepBreadthFirst(node, (x) => x instanceof Node);
    expect(expected).toHaveLength(2);
    expect(expected[0]).toMatchObject({name: "the-FIRST-item-i-was-looking-for"});
    expect(expected[1]).toMatchObject({name: "the-SECOND-item-i-was-looking-for"});
  });
});
