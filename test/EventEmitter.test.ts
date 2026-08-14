import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "../src/EventEmitter";

type Events = {
  ping: { value: number };
  other: string;
};

describe("EventEmitter", () => {
  it("emits to registered handlers", () => {
    const emitter = new EventEmitter<Events>();
    const handler = vi.fn();
    emitter.on("ping", handler);
    emitter.emit("ping", { value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it("supports multiple handlers for the same event", () => {
    const emitter = new EventEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on("ping", a);
    emitter.on("ping", b);
    emitter.emit("ping", { value: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("removes a handler with off()", () => {
    const emitter = new EventEmitter<Events>();
    const handler = vi.fn();
    emitter.on("ping", handler);
    emitter.off("ping", handler);
    emitter.emit("ping", { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not emit to handlers of other events", () => {
    const emitter = new EventEmitter<Events>();
    const handler = vi.fn();
    emitter.on("other", handler);
    emitter.emit("ping", { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not throw when emitting an event with no listeners", () => {
    const emitter = new EventEmitter<Events>();
    expect(() => emitter.emit("ping", { value: 1 })).not.toThrow();
  });

  it("removes all listeners with removeAllListeners", () => {
    const emitter = new EventEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on("ping", a);
    emitter.on("other", b);
    emitter.removeAllListeners();
    emitter.emit("ping", { value: 1 });
    emitter.emit("other", "x");
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("does not throw when a handler throws and still calls the others", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const emitter = new EventEmitter<Events>();
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    emitter.on("ping", throwing);
    emitter.on("ping", ok);
    expect(() => emitter.emit("ping", { value: 1 })).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
