import { vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

vi.mock("./utils/eventBus", () => ({
  emit: vi.fn(),
  on: vi.fn(() => () => {})
}));
