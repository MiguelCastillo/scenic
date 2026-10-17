import {EventBus, BufferedEventBus} from "./event-bus.js";

describe("EventBus", () => {
  test("keeps events in order until taken", () => {
    const bus = new EventBus();
    bus.publish("p2", 1);
    bus.publish("player", "a");
    bus.publish("p2", 2);

    expect(bus.take()).toEqual({p2: [1, 2], player: ["a"]});
    expect(bus.take()).toEqual({});
  });

  test("drops a limited channel's oldest events, and logs them", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const bus = new EventBus();
    bus.limit("p2", 2);
    [1, 2, 3, 4].forEach((event) => bus.publish("p2", event));
    [1, 2, 3, 4].forEach((event) => bus.publish("player", event));

    expect(bus.take()).toEqual({p2: [3, 4], player: [1, 2, 3, 4]});
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("BufferedEventBus", () => {
  test("keeps the last message on each channel until the next frame", () => {
    const bus = new BufferedEventBus();
    bus.publish("race", {lap: 1});
    bus.publish("race", {lap: 2});

    expect(bus.latest("race")).toEqual({lap: 2});
    expect(bus.messages()).toEqual({race: {lap: 2}});

    bus.beginFrame();
    expect(bus.latest("race")).toBeUndefined();
  });
});
