import { describe, expect, it } from "vitest";
import {
  buildChatRequestPayload,
  deepMerge,
  generationFields,
  parseAdvancedParams,
} from "@/lib/ai/client";

const BASE = {
  temperature: 0.5,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "",
  advancedJson: "",
};

describe("generationFields", () => {
  it("maps every custom parameter into the request body", () => {
    expect(
      generationFields(
        {
          temperature: 0.55,
          topP: 0.9,
          topK: 40,
          frequencyPenalty: 0.2,
          presencePenalty: -0.1,
          reasoningEffort: "",
          advancedJson: "",
        },
        0.7,
      ),
    ).toEqual({
      temperature: 0.55,
      top_p: 0.9,
      top_k: 40,
      frequency_penalty: 0.2,
      presence_penalty: -0.1,
    });
  });

  it("omits top_k when disabled", () => {
    const fields = generationFields({ ...BASE, temperature: 0.5 }, 0.7);
    expect(fields).not.toHaveProperty("top_k");
    expect(fields.top_p).toBe(1);
  });

  it("sends reasoning_effort only when non-empty", () => {
    expect(generationFields({ ...BASE, reasoningEffort: "  high  " }, 0.7)).toMatchObject({
      reasoning_effort: "high",
    });
    expect(generationFields({ ...BASE, reasoningEffort: "   " }, 0.7)).not.toHaveProperty(
      "reasoning_effort",
    );
  });

  it("falls back to a temperature when no preset params exist", () => {
    expect(generationFields(undefined, 0.85)).toEqual({ temperature: 0.85 });
  });
});

describe("parseAdvancedParams", () => {
  it("returns an empty object for blank input", () => {
    expect(parseAdvancedParams(undefined)).toEqual({});
    expect(parseAdvancedParams("   ")).toEqual({});
  });

  it("parses a JSON object", () => {
    expect(parseAdvancedParams('{"temperature":0.9,"safetySettings":[]}')).toEqual({
      temperature: 0.9,
      safetySettings: [],
    });
  });

  it("ignores invalid JSON without throwing", () => {
    expect(parseAdvancedParams("{not json")).toEqual({});
  });

  it("ignores non-object JSON without throwing", () => {
    expect(parseAdvancedParams("[1,2,3]")).toEqual({});
    expect(parseAdvancedParams("42")).toEqual({});
    expect(parseAdvancedParams("null")).toEqual({});
  });
});

describe("deepMerge", () => {
  it("merges nested objects without dropping sibling keys", () => {
    expect(
      deepMerge(
        { generation: { temperature: 0.5, top_p: 0.9 }, keep: true },
        { generation: { temperature: 0.9 }, added: "yes" },
      ),
    ).toEqual({
      generation: { temperature: 0.9, top_p: 0.9 },
      keep: true,
      added: "yes",
    });
  });

  it("replaces arrays instead of merging them", () => {
    expect(deepMerge({ safetySettings: [1, 2, 3] }, { safetySettings: [9] })).toEqual({
      safetySettings: [9],
    });
  });
});

describe("buildChatRequestPayload", () => {
  const messages = [{ role: "user" as const, content: "Hello" }];

  it("deep-merges custom parameters and overrides matching settings", () => {
    const payload = buildChatRequestPayload({
      model: "test-model",
      messages,
      stream: true,
      params: {
        ...BASE,
        temperature: 0.4,
        advancedJson: JSON.stringify({
          temperature: 0.9,
          safetySettings: [{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }],
        }),
      },
    });
    expect(payload.model).toBe("test-model");
    expect(payload.messages).toEqual(messages);
    expect(payload.stream).toBe(true);
    expect(payload.temperature).toBe(0.9);
    expect(payload.safetySettings).toEqual([
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    ]);
  });

  it("never lets custom JSON replace the model or messages", () => {
    const payload = buildChatRequestPayload({
      model: "real-model",
      messages,
      stream: false,
      params: {
        ...BASE,
        advancedJson: JSON.stringify({
          model: "corrupted",
          messages: [{ role: "user", content: "overridden" }],
        }),
      },
    });
    expect(payload.model).toBe("real-model");
    expect(payload.messages).toEqual(messages);
  });

  it("ignores invalid custom JSON", () => {
    const payload = buildChatRequestPayload({
      model: "test-model",
      messages,
      stream: false,
      params: { ...BASE, advancedJson: "{broken" },
    });
    expect(payload.model).toBe("test-model");
    expect(payload.messages).toEqual(messages);
    expect(payload.temperature).toBe(BASE.temperature);
  });
});
