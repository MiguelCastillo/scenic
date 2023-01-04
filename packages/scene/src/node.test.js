import {mat4} from "@scenic/math";

import {Node, _clearIDsForTests} from "./node.js";

describe("Scene Node add/remove child", () => {
  it("two new node - first ID 1 and second with ID 2", () => {
    _clearIDsForTests();
    expect(new Node({}).id).toEqual(1);
    expect(new Node({}).id).toEqual(2);
  });

  it("adding a node as a children will get registered by id", () => {
    _clearIDsForTests();
    const parent = new Node({});
    const child = new Node({});
    expect(parent.id).toEqual(1);
    expect(child.id).toEqual(2);
    expect(parent.add(child)).toEqual(parent);
    expect(parent.childrenByID).toEqual({2: child});
    expect(parent.items).toEqual([child]);
    expect(child.parent).toEqual(parent);
  });

  it("removing a node will clean things up", () => {
    _clearIDsForTests();
    const parent = new Node({});
    const child = new Node({});
    parent.add(child);
    expect(parent.childrenByID).toEqual({2: child});
    expect(parent.remove(child)).toEqual(parent);
    expect(parent.childrenByID).toEqual({});
    expect(parent.items).toEqual([]);
    expect(child.parent).toBeNull();
  });

  it("adding a node with a custom id, the custom ID has higher precedence than built in ones.", () => {
    _clearIDsForTests();
    const parent = new Node({id: "real-funny-id"});
    expect(parent.id).toEqual("real-funny-id");
  });
});

describe("Scene Node reprender/render", () => {
  it("preRender sets Identity world/local matrix for root nodes", () => {
    _clearIDsForTests();
    const root = new Node({id: "groot"});

    root.preRender();
    expect(root.worldMatrix.data).toEqual(mat4.identity());
    expect(root.localMatrix.data).toEqual(mat4.identity());
  });

  it("preRender propagates parent matrices", () => {
    _clearIDsForTests();
    const root = new Node({id: "groot"});
    const child = new Node({id: "child.1"});
    const grandchild = new Node({id: "child.1.1"});
    root.add(child.add(grandchild));

    root.withLocalMatrix(mat4.Matrix4.rotate(32, 0, 40));
    child.withLocalMatrix(mat4.Matrix4.rotate(14, 45, 71));
    grandchild.withLocalMatrix(mat4.Matrix4.rotate(28, 3, 11));

    root.preRender();
    expect(root.worldMatrix.data).toEqual(mat4.Matrix4.rotate(32, 0, 40).data);
    child.preRender();
    expect(child.worldMatrix.data).toEqual(mat4.Matrix4.rotate(32, 0, 40).rotate(14, 45, 71).data);
    grandchild.preRender();
    expect(grandchild.worldMatrix.data).toEqual(
      mat4.Matrix4.rotate(32, 0, 40).rotate(14, 45, 71).rotate(28, 3, 11).data
    );
  });
});

describe("findChildByID", () => {
  it("find child in the first layer of items", () => {
    const root = new Node({id: "groot"});
    root.addItems([
      new Node({id: "child.1"}),
      new Node({id: "child.2"}),
      new Node({id: "child.3"}),
    ]);

    expect(Node.findChildByID(root, "child.3")).toMatchObject({
      id: "child.3",
    });
  });

  it("find child in the second layer of items", () => {
    const root = new Node({id: "groot"});
    root.addItems([
      new Node({id: "child.1"}).addItems([
        new Node({id: "child.1.1"}),
        new Node({id: "child.1.2"}),
        new Node({id: "child.1.3"}),
      ]),
      new Node({id: "child.2"}).addItems([
        new Node({id: "child.2.1"}),
        new Node({id: "child.2.2"}),
        new Node({id: "child.2.3"}),
      ]),
      new Node({id: "child.3"}).addItems([
        new Node({id: "child.3.1"}),
        new Node({id: "child.3.2"}),
        new Node({id: "child.3.3"}),
      ]),
    ]);

    expect(Node.findChildByID(root, "child.3.3")).toMatchObject({
      id: "child.3.3",
    });
  });

  it("find child in the third layer of items", () => {
    const root = new Node({id: "groot"});
    root.addItems([
      new Node({id: "child.1"})
        .addItems([
          new Node({id: "child.1.1"}).addItems([
            new Node({id: "child.1.1.1"}),
            new Node({id: "child.1.1.2"}),
            new Node({id: "child.1.1.3"}),
          ]),
          new Node({id: "child.1.2"}).addItems([
            new Node({id: "child.1.2.1"}),
            new Node({id: "child.1.2.2"}),
            new Node({id: "child.1.2.3"}),
          ]),
          new Node({id: "child.1.3"}),
        ])
        .addItems([
          new Node({id: "child.1.3.1"}),
          new Node({id: "child.1.3.2"}),
          new Node({id: "child.1.3.3"}),
        ]),
      new Node({id: "child.2"})
        .addItems([
          new Node({id: "child.2.1"}).addItems([
            new Node({id: "child.2.1.1"}),
            new Node({id: "child.2.1.2"}),
            new Node({id: "child.2.1.3"}),
          ]),
          new Node({id: "child.2.2"}).addItems([
            new Node({id: "child.2.2.1"}),
            new Node({id: "child.2.2.2"}),
            new Node({id: "child.2.2.3"}),
          ]),
          new Node({id: "child.2.3"}),
        ])
        .addItems([
          new Node({id: "child.2.3.1"}),
          new Node({id: "child.2.3.2"}),
          new Node({id: "child.2.3.3"}),
        ]),
      new Node({id: "child.3"})
        .addItems([
          new Node({id: "child.3.1"}).addItems([
            new Node({id: "child.3.1.1"}),
            new Node({id: "child.3.1.2"}),
            new Node({id: "child.3.1.3"}),
          ]),
          new Node({id: "child.3.2"}).addItems([
            new Node({id: "child.3.2.1"}),
            new Node({id: "child.3.2.2"}),
            new Node({id: "child.3.2.3"}),
          ]),
          new Node({id: "child.3.3"}),
        ])
        .addItems([
          new Node({id: "child.3.3.1"}),
          new Node({id: "child.3.3.2"}),
          new Node({id: "child.3.3.3"}),
        ]),
    ]);

    expect(Node.findChildByID(root, "child.3.3.3")).toMatchObject({
      id: "child.3.3.3",
    });
  });
});
