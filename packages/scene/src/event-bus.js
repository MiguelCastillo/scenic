// The buses carry events, plain data on named channels, from publishers to
// receivers. Publishers publish events to a bus, and receivers pull them from
// it when they are ready to handle them, such as once a frame or a few times
// a second: a bus never calls anyone.

// EventBus keeps every event published on it, in order, until it is taken,
// for events that each matter, such as each key going down and up.
//
// A channel can be limited to a number of events, with limit, so that its
// events pile up only so far when nobody takes them, such as another
// player's messages, which keep coming while a page in the background draws
// no frames. A limited channel drops its oldest events to make room for new
// ones, so a receiver that falls that far behind gets the latest, and logs
// what it dropped. Channels are unlimited otherwise, so that events that
// must not be lost, such as a key coming up, never are.
//
// Its API: publish(channel, event), limit(channel, maxEvents), and take(),
// which returns the events since the last take, as {channel: [event, ...]},
// in the order the channels were first published, and forgets them.
export class EventBus {
  constructor() {
    this._eventsByChannel = new Map();
    this._maxEventsByChannel = new Map();
  }

  publish(channel, event) {
    const events = this._eventsByChannel.get(channel) ?? [];
    events.push(event);
    const maxEvents = this._maxEventsByChannel.get(channel) ?? Infinity;
    if (events.length > maxEvents) {
      const dropped = events.splice(0, events.length - maxEvents);
      // eslint-disable-next-line no-console
      console.warn(`dropped ${dropped.length} events on "${channel}", which nobody took`, dropped);
    }
    this._eventsByChannel.set(channel, events);
  }

  limit(channel, maxEvents) {
    this._maxEventsByChannel.set(channel, maxEvents);
  }

  take() {
    const eventsByChannel = Object.fromEntries(this._eventsByChannel);
    this._eventsByChannel.clear();
    return eventsByChannel;
  }
}

// BufferedEventBus keeps only the last message published on each channel in
// a frame, for messages that each say all there is to know, such as what a
// HUD shows. A publisher can publish as often as it likes, such as every
// frame, and receivers pull the latest whenever they like, as often as they
// like: pulling forgets nothing.
//
// beginFrame starts a frame's messages, so that a channel that stops
// publishing is gone from the next frame's messages, rather than still
// saying what it last said.
//
// Its API: publish(channel, message), latest(channel), which is the last
// message on channel, or undefined, messages(), which is the last message on
// every channel, as {channel: message}, and beginFrame().
export class BufferedEventBus {
  constructor() {
    this._messagesByChannel = new Map();
  }

  publish(channel, message) {
    this._messagesByChannel.set(channel, message);
  }

  latest(channel) {
    return this._messagesByChannel.get(channel);
  }

  messages() {
    return Object.fromEntries(this._messagesByChannel);
  }

  beginFrame() {
    this._messagesByChannel.clear();
  }
}
