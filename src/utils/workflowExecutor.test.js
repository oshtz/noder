import { describe, expect, it, vi } from "vitest";
import { executeWorkflow } from "./workflowExecutor";

const createMediaNode = (id, overrides = {}) => ({
  id,
  type: "media",
  data: {
    mediaType: "image",
    mediaPath: "/tmp/image.png",
    replicateFileId: null,
    replicateUrl: null,
    ...overrides
  }
});

const createTextNode = (id, overrides = {}) => ({
  id,
  type: "text",
  data: {
    prompt: "",
    ...overrides
  }
});

describe("executeWorkflow", () => {
  it("skips cached nodes and keeps cached outputs", async () => {
    const nodes = [createMediaNode("a"), createMediaNode("b")];
    const onNodeStart = vi.fn();
    const onNodeComplete = vi.fn();
    const onNodeSkip = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeStart,
      onNodeComplete,
      onNodeSkip,
      initialNodeOutputs: {
        a: { out: { type: "image", value: "cached-output" } }
      },
      autoCleanup: false
    });

    expect(onNodeSkip).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), "cached");
    expect(onNodeStart).toHaveBeenCalledTimes(1);
    expect(onNodeComplete).toHaveBeenCalledTimes(1);
    expect(result.nodeOutputs.a.out.value).toBe("cached-output");
    expect(Object.keys(result.nodeOutputs)).toEqual(expect.arrayContaining(["a", "b"]));
    expect(result.completedCount).toBe(2);
  });

  it("skips explicit node ids without executing them", async () => {
    const nodes = [createMediaNode("a"), createMediaNode("b")];
    const onNodeStart = vi.fn();
    const onNodeSkip = vi.fn();

    await executeWorkflow({
      nodes,
      edges: [],
      onNodeStart,
      onNodeSkip,
      skipNodeIds: ["b"],
      autoCleanup: false
    });

    expect(onNodeSkip).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }), "skipped");
    expect(onNodeStart).toHaveBeenCalledTimes(1);
  });

  it("continues execution when continueOnError is enabled", async () => {
    const nodes = [
      createMediaNode("a"),
      createTextNode("b", { prompt: "" })
    ];
    const onNodeStart = vi.fn();
    const onNodeComplete = vi.fn();
    const onNodeError = vi.fn();

    const result = await executeWorkflow({
      nodes,
      edges: [],
      onNodeStart,
      onNodeComplete,
      onNodeError,
      continueOnError: true,
      autoCleanup: false
    });

    expect(onNodeStart).toHaveBeenCalledTimes(2);
    expect(onNodeComplete).toHaveBeenCalledTimes(1);
    expect(onNodeError).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No prompt provided");
    expect(result.nodeOutputs.a).toBeDefined();
  });
});
