#!/usr/bin/env node
import http from "node:http";

const PORT = Number(process.env.MOCK_AI_PORT || 8787);
const FAIL = process.env.MOCK_AI_FAIL === "1";
const MODELS = ["mock-planner", "mock-executor", "mock-summarizer"];
const CHUNK_DELAY = Number(process.env.MOCK_AI_DELAY_MS || 12);
let lastRequest = null;

const PROSE = `The house had been empty for eleven years, and still the gate knew her hand.

Mara stood on the gravel with the key already warm between her fingers. Behind her, the taxi reversed down the lane, its tyres popping over the ruts she remembered from childhood. Ahead, the garden had gone feral in a way that looked deliberate. Blackberry canes had stitched themselves through the ironwork. The laurel had swallowed the path. Somewhere inside that green pressure, a bird repeated the same three notes, patient as a clock.

She did not go in at once. She walked the wall instead, counting the bricks her father had replaced the summer she turned nine. Twenty-three. He had marked each one with a thumbprint before the mortar dried, and the prints were still there, small hollows holding the light.

"You came," said a voice from the other side of the wall.

Mara did not turn. "You sent the key."

"I sent the key to the solicitor." A pause. "I did not think you would come."

The voice belonged to a woman Mara had last seen at a funeral, standing so far back from the grave that she might have been a stranger. Now she stood among the nettles with mud on her boots and a pair of secateurs hanging from her belt, as if she had been pruning the ruin for years and had simply forgotten to mention it.

"The garden is different," Mara said.

"The garden is honest." The woman pushed the gate open. It did not creak. "Everything else in this family was arranged."

Inside, the house smelled of cold ash and lemon oil. The furniture had been covered with sheets, but the sheets had been washed, folded, and tucked with the corners squared. Someone had been caring for the absence. Mara put her bag down in the hall and listened to the building settle around her, a long sequence of small complaints.

On the kitchen table lay a map she had never seen before. It showed the house, the lane, the orchard, and then, beyond the orchard, a coastline that did not exist. The paper was old. The ink was not.

"Where did this come from?" she asked.

The woman was already at the window, looking out. "The same place as the key," she said. "The same place as you."

Mara touched the map. The coastline was warm.

Outside, the bird began its three notes again, and this time the garden answered.`;

function premiseText() {
  return `A cartographer returns to her childhood home after eleven years and finds a map of a coastline that should not exist. The house is unchanged in ways that feel accusatory and altered in ways no one will explain. A woman she barely remembers has been tending the garden and the absence, and she knows more about the map than she admits. As the coastline begins to appear where no coast has ever been, the protagonist must decide whether to preserve the family's carefully arranged version of the past or follow the map into a geography that may cost her the last living members of her family. The novel is a quiet, atmospheric story about inheritance, cartography, and the stories families use to make themselves legible.`;
}

function titleText() {
  return "The Cartographer's Debt";
}

function plannerText() {
  return `Here is a shape for the chapter.

1. **Open on arrival, not explanation.** Mara reaches the house at dusk. The gate already knows her hand. Keep the taxi leaving; let the lane feel like a border.
2. **Refuse the obvious reunion.** She does not go inside immediately. She walks the wall and counts the bricks her father replaced. This gives us her history without a flashback.
3. **Introduce the other woman from off-page.** She speaks from the far side of the wall. She has been tending the garden. She did not expect Mara to come. Do not name the relationship yet.
4. **The map on the kitchen table.** It shows a coastline that does not exist. The paper is old; the ink is not. This is the chapter's turn.
5. **End on a sensory impossibility.** Mara touches the map and the coastline is warm. The bird repeats three notes; the garden answers.

Continuity to protect: the father's brickwork, the eleven-year absence, the woman's secateurs, the washed sheets. Leave open: who sent the key, why the woman stayed, and what the warm ink means.

Keep the prose close to Mara. She notices surfaces; she withholds interpretation. The chapter should end before she decides anything.`;
}

function summaryText() {
  return `Mara returns to her childhood home after eleven years and finds the garden overgrown but deliberately tended. A woman she barely remembers, last seen at a funeral, is working among the nettles and admits she did not expect Mara to come. Inside, the furniture is covered with freshly washed sheets, and a map lies on the kitchen table showing a coastline that does not exist. The paper is old, but the ink is not. When Mara touches the map, the coastline is warm. The chapter establishes the father's brickwork, the eleven-year absence, and the woman's unexplained presence. It leaves open who sent the key, why the woman stayed, and what the warm ink signifies.`;
}

function responseFor(messages) {
  const all = messages
    .map((message) => message.content)
    .join("\n")
    .toLowerCase();

  if (all.includes("you name novels")) return titleText();
  if (all.includes("convert an author's brainstorming conversation into the novel's premise")) {
    return premiseText();
  }
  if (all.includes("you are the planner")) return plannerText();
  if (all.includes("you are the executor")) return PROSE;
  if (all.includes("you maintain the story vault")) return summaryText();
  return "OK.";
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  console.log(`${request.method} ${url.pathname}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && url.pathname === "/last-request") {
    return sendJson(response, 200, lastRequest ?? { detail: "No chat request yet." });
  }

  if (request.method === "GET" && url.pathname.endsWith("/models")) {
    return sendJson(response, 200, {
      object: "list",
      data: MODELS.map((id) => ({ id, object: "model", owned_by: "mock" })),
    });
  }

  if (request.method === "POST" && url.pathname.endsWith("/chat/completions")) {
    if (FAIL) {
      return sendJson(response, 500, {
        error: { message: "Mock provider failure requested by MOCK_AI_FAIL=1." },
      });
    }

    let body;
    try {
      body = await readBody(request);
    } catch {
      return sendJson(response, 400, { error: { message: "Invalid JSON body." } });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const content = responseFor(messages);
    const model = body.model || "mock-planner";
    lastRequest = {
      model,
      stream: Boolean(body.stream),
      temperature: body.temperature,
      top_p: body.top_p,
      top_k: body.top_k,
      frequency_penalty: body.frequency_penalty,
      presence_penalty: body.presence_penalty,
      system: messages.find((message) => message.role === "system")?.content?.slice(0, 600) ?? null,
      user: messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n")
        .slice(0, 1200),
    };
    console.log(
      `  model=${model} stream=${Boolean(body.stream)} params=${JSON.stringify({ temperature: body.temperature, top_p: body.top_p, top_k: body.top_k, frequency_penalty: body.frequency_penalty, presence_penalty: body.presence_penalty })}`,
    );

    if (!body.stream) {
      return sendJson(response, 200, {
        id: `mock-${Date.now()}`,
        object: "chat.completion",
        model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: content.length, total_tokens: 100 + content.length },
      });
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const reasoning = "The request needs a focused response. I will keep the structure concrete and stop before inventing a resolution.";
    response.write(
      `data: ${JSON.stringify({
        id: `mock-${Date.now()}`,
        object: "chat.completion.chunk",
        model,
        choices: [{ index: 0, delta: { reasoning_content: reasoning }, finish_reason: null }],
      })}\n\n`,
    );

    let index = 0;
    const chunkSize = 7;
    const timer = setInterval(() => {
      if (index >= content.length) {
        clearInterval(timer);
        response.write(
          `data: ${JSON.stringify({
            id: `mock-${Date.now()}`,
            object: "chat.completion.chunk",
            model,
            choices: [],
            usage: { prompt_tokens: 100, completion_tokens: content.length, total_tokens: 100 + content.length },
          })}\n\n`,
        );
        response.write("data: [DONE]\n\n");
        response.end();
        return;
      }
      const text = content.slice(index, index + chunkSize);
      index += chunkSize;
      response.write(
        `data: ${JSON.stringify({
          id: `mock-${Date.now()}`,
          object: "chat.completion.chunk",
          model,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
        })}\n\n`,
      );
    }, CHUNK_DELAY);

    request.on("close", () => clearInterval(timer));
    return;
  }

  sendJson(response, 404, { error: { message: "Not found." } });
});

server.listen(PORT, () => {
  console.log(`Mock OpenAI-compatible provider on http://localhost:${PORT}/v1`);
  console.log(`Models: ${MODELS.join(", ")}`);
  if (FAIL) console.log("MOCK_AI_FAIL=1: chat requests will return 500.");
});
