import { describe, expect, it } from "vitest";
import {
  addAssistantAlternative,
  deleteMessageVersion,
  editUserMessage,
  switchMessageVersion,
} from "@/lib/chat/messages";
import type { Chat, ChatMessage } from "@/lib/schemas";

const user: ChatMessage = {
  id: "u1",
  role: "user",
  content: "Original prompt",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const assistant: ChatMessage = {
  id: "a1",
  role: "assistant",
  content: "First answer",
  createdAt: "2026-01-01T00:01:00.000Z",
};
const laterUser: ChatMessage = {
  id: "u2",
  role: "user",
  content: "Follow up",
  createdAt: "2026-01-01T00:02:00.000Z",
};
const laterAssistant: ChatMessage = {
  id: "a2",
  role: "assistant",
  content: "Second answer",
  createdAt: "2026-01-01T00:03:00.000Z",
};

function chat(): Chat {
  return {
    version: 1,
    scope: 1,
    messages: [user, structuredClone(assistant), laterUser, laterAssistant],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("assistant response versions", () => {
  it("adds a new alternative without overwriting the previous one", () => {
    const next = addAssistantAlternative(chat(), "a1", {
      id: "a1-v2",
      content: "Second answer",
      reasoning: "Think",
      createdAt: "2026-01-01T00:04:00.000Z",
    });
    const message = next.messages.find((item) => item.id === "a1")!;
    expect(message.alternatives).toHaveLength(2);
    expect(message.alternatives?.[0].content).toBe("First answer");
    expect(message.content).toBe("Second answer");
    expect(message.activeAlternativeId).toBe("a1-v2");
  });

  it("switches to a previous alternative", () => {
    const added = addAssistantAlternative(chat(), "a1", {
      id: "a1-v2",
      content: "Second answer",
      createdAt: "2026-01-01T00:04:00.000Z",
    });
    const switched = switchMessageVersion(added, "a1", "a1");
    const message = switched.messages.find((item) => item.id === "a1")!;
    expect(message.content).toBe("First answer");
    expect(message.activeAlternativeId).toBe("a1");
  });

  it("deletes only the active version", () => {
    const added = addAssistantAlternative(chat(), "a1", {
      id: "a1-v2",
      content: "Second answer",
      createdAt: "2026-01-01T00:04:00.000Z",
    });
    const deleted = deleteMessageVersion(added, "a1");
    const message = deleted.messages.find((item) => item.id === "a1")!;
    expect(message.alternatives).toHaveLength(1);
    expect(message.content).toBe("First answer");
  });

  it("removes the message when the last version is deleted", () => {
    const deleted = deleteMessageVersion(chat(), "a1");
    expect(deleted.messages.some((item) => item.id === "a1")).toBe(false);
    expect(deleted.messages).toHaveLength(3);
  });
});

describe("edit user message", () => {
  it("edits the prompt and drops the downstream branch", () => {
    const edited = editUserMessage(chat(), "u1", "Edited prompt");
    expect(edited.messages).toHaveLength(1);
    expect(edited.messages[0]).toEqual({ ...user, content: "Edited prompt" });
  });
});
