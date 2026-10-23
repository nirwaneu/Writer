import { describe, expect, it } from "vitest";
import { generationFields } from "@/lib/ai/client";

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
    const fields = generationFields(
      {
        temperature: 0.5,
        topP: 1,
        topK: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        reasoningEffort: "",
      },
      0.7,
    );
    expect(fields).not.toHaveProperty("top_k");
    expect(fields.top_p).toBe(1);
  });

  it("sends reasoning_effort only when non-empty", () => {
    const base = {
      temperature: 0.5,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
    };

    expect(generationFields({ ...base, reasoningEffort: "  high  " }, 0.7)).toMatchObject({
      reasoning_effort: "high",
    });
    expect(generationFields({ ...base, reasoningEffort: "   " }, 0.7)).not.toHaveProperty(
      "reasoning_effort",
    );
  });

  it("falls back to a temperature when no preset params exist", () => {
    expect(generationFields(undefined, 0.85)).toEqual({ temperature: 0.85 });
  });
});
