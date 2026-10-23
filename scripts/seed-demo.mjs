#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
console.warn(
  "seed:demo is destructive: it deletes vibedraft.db and writes synthetic demo files. Use a disposable DATA_DIR.",
);
const NOVELS = path.join(DATA_DIR, "novels");
const SLUG = "the-cartographers-debt";
const DIR = path.join(NOVELS, SLUG);
const now = new Date().toISOString();

const PREMISE = `A cartographer returns to her childhood home after eleven years and finds a map of a coastline that should not exist. The house is unchanged in ways that feel accusatory and altered in ways no one will explain. A woman she barely remembers has been tending the garden and the absence, and she knows more about the map than she admits. As the coastline begins to appear where no coast has ever been, Mara must decide whether to preserve the family's carefully arranged version of the past or follow the map into a geography that may cost her the last living members of her family.`;

const CHAPTER_ONE = `The house had been empty for eleven years, and still the gate knew her hand.

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

const CHAPTER_TWO = `The woman's name was Ren, and she would not say how long she had been living in the cottage at the bottom of the orchard.

"Long enough to know which apples are worth saving," she said.

They stood on opposite sides of the kitchen table. The map lay between them, its impossible coastline catching the last of the light. Mara had spent the morning photographing it from six angles. Each photograph had come out slightly wrong, as though the lens were remembering a different room.

"The survey office has no record of this paper," Mara said. "The watermark is from a mill that closed in 1911. The ink is newer than the mill."

Ren filled the kettle. "You always did like the part of the job where the facts disagree."

"You know me."

"I know your father."

That was the first time either of them had said his name aloud. The kettle began to tick. Outside, the orchard had gone very still, the way a room goes still when someone stops pretending not to listen.

"He used to walk the boundary every Sunday," Ren said. "Even after your mother left. Even after you stopped coming. He would take a pencil and a notebook and write down what had moved."

"Boundaries don't move."

"His did." Ren set two cups on the table. "Some Sundays the orchard was forty paces across. Some Sundays it was fifty. He never wrote down the discrepancy. He just drew the same line in a different place and dated it."

Mara looked at the map again. Beyond the orchard, the coastline curved north before breaking into a cluster of islands that had no business existing. She knew every chart of this county. She had drawn half of them. The islands were not there. They had never been there. But the ink had a tide line, and the tide line was brown at the edges, as if it had been wetted and left to dry.

"Where does it go?" she asked.

Ren sat down. "That depends on who is holding it."

The answer should have been evasive. Instead it sounded like a warning. Mara felt the floor of the conversation shift, the way a boat shifts when someone steps aboard.

"You think I'm here to finish his work."

"I think you're here because the map is warm," Ren said. "The rest is up to you."

That night Mara slept in her old room. The sheets smelled of lavender and the window would not close all the way, exactly as it had when she was a girl. She lay awake listening to the orchard. At some point after midnight, she heard the gate open.

She did not get up. She told herself it was the wind.

In the morning, there was a new line on the map. It ran from the house to the coast, and it had been drawn in a hand she recognized.`;

const CHAPTER_ONE_SUMMARY = `Mara returns to her childhood home after eleven years and finds the garden overgrown but deliberately tended. A woman she barely remembers, last seen at a funeral, is working among the nettles and admits she did not expect Mara to come. Inside, the furniture is covered with freshly washed sheets, and a map lies on the kitchen table showing a coastline that does not exist. The paper is old, but the ink is not. When Mara touches the map, the coastline is warm. The chapter establishes the father's brickwork, the eleven-year absence, and the woman's unexplained presence. It leaves open who sent the key, why the woman stayed, and what the warm ink signifies.`;

const PLAN_ONE = `Here is a shape for the chapter.

1. **Open on arrival, not explanation.** Mara reaches the house at dusk. The gate already knows her hand. Keep the taxi leaving; let the lane feel like a border.
2. **Refuse the obvious reunion.** She walks the wall and counts the bricks her father replaced. History without a flashback.
3. **Introduce Ren from off-page.** She speaks from the far side of the wall. She has been tending the garden. Do not name the relationship yet.
4. **The map on the kitchen table.** A coastline that does not exist. Old paper, new ink. This is the turn.
5. **End on a sensory impossibility.** Mara touches the map and the coastline is warm. The bird repeats three notes; the garden answers.`;

const PLAN_TWO = `Keep the chapter domestic and increasingly strange.

1. Ren and Mara circle each other in the kitchen. Establish Ren's intimacy with the father without explaining it.
2. The survey-office discrepancy: old paper, new ink, no record. Mara's professional competence is the pressure valve.
3. Ren describes the father walking the boundary every Sunday, measuring an orchard that changed size. This is the first real crack in the family story.
4. Ren says the map depends on who is holding it. Do not explain.
5. Night: the gate opens. Mara stays in bed. Morning: a new line in her father's hand.

End before Mara decides whether to follow the line.`;

function chat(scope, messages) {
  return {
    version: 1,
    scope,
    messages,
    updatedAt: now,
  };
}

function message(id, role, content) {
  return { id, role, content, createdAt: now };
}

const outline = {
  version: 1,
  id: "demo-cartographers-debt",
  title: "The Cartographer's Debt",
  premise: PREMISE,
  status: "active",
  characters: [
    {
      name: "Mara Voss",
      role: "protagonist",
      description: "A cartographer in her late thirties who maps coastlines for a living and has not been home in eleven years.",
    },
    {
      name: "Ren",
      role: "the woman in the garden",
      description: "Tends the orchard and the house. Knew Mara's father. Will not explain how long she has been there.",
    },
    {
      name: "Ilya Voss",
      role: "Mara's father",
      description: "Dead eleven years. Walked the boundary every Sunday and measured an orchard that changed size.",
    },
  ],
  chapters: [
    {
      number: 1,
      title: "The Gate",
      summary: CHAPTER_ONE_SUMMARY,
      status: "summarized",
      wordCount: CHAPTER_ONE.trim().split(/\s+/).length,
      summaryStale: false,
      updatedAt: now,
      summaryUpdatedAt: now,
    },
    {
      number: 2,
      title: "The Wall",
      summary: "",
      status: "drafted",
      wordCount: CHAPTER_TWO.trim().split(/\s+/).length,
      summaryStale: false,
      updatedAt: now,
    },
    {
      number: 3,
      title: "The Warm Ink",
      summary: "",
      status: "planned",
      wordCount: 0,
      summaryStale: false,
      updatedAt: now,
    },
  ],
  currentChapter: 2,
  createdAt: now,
  updatedAt: now,
};

const config = {
  version: 1,
  baseUrl: "http://localhost:8787/v1",
  apiKey: "",
  models: {
    planner: "mock-planner",
    executor: "mock-executor",
    summarizer: "mock-summarizer",
  },
  connection: {
    ok: true,
    checkedAt: now,
    latencyMs: 12,
    detail: "Mock provider. Development only.",
  },
  updatedAt: now,
};

await rm(path.join(DIR, "book_config.json"), { force: true });
for (const suffix of ["", "-wal", "-shm"]) {
  await rm(path.join(DATA_DIR, `vibedraft.db${suffix}`), { force: true });
}
await mkdir(path.join(DIR, "chats"), { recursive: true });
await mkdir(path.join(DIR, "chapters"), { recursive: true });
await mkdir(NOVELS, { recursive: true });

await writeFile(path.join(DATA_DIR, "app_config.json"), JSON.stringify(config, null, 2) + "\n");
await writeFile(path.join(DIR, "outline.json"), JSON.stringify(outline, null, 2) + "\n");
await writeFile(path.join(DIR, "chapters", "chapter_1.md"), CHAPTER_ONE + "\n");
await writeFile(path.join(DIR, "chapters", "chapter_2.md"), CHAPTER_TWO + "\n");
await writeFile(path.join(DIR, "chapters", "chapter_3.md"), "");

await writeFile(
  path.join(DIR, "chats", "premise_chat.json"),
  JSON.stringify(
    chat("premise", [
      message("p1", "user", "A cartographer goes home and finds a map of a coastline that shouldn't exist."),
      message("p2", "assistant", "That gives us a strong spine. What does she want from the house: proof, forgiveness, or an exit?"),
      message("p3", "user", "Proof that her father wasn't crazy. And maybe an exit."),
      message("p4", "assistant", "Then the map is both evidence and a door. Keep the family's version of the past as the antagonist."),
    ]),
    null,
    2,
  ) + "\n",
);

await writeFile(
  path.join(DIR, "chats", "chapter_1_chat.json"),
  JSON.stringify(
    chat(1, [
      message("c1u1", "user", "Plan the arrival. I want the house to feel like a border."),
      message("c1a1", "assistant", PLAN_ONE),
    ]),
    null,
    2,
  ) + "\n",
);

await writeFile(
  path.join(DIR, "chats", "chapter_2_chat.json"),
  JSON.stringify(
    chat(2, [
      message("c2u1", "user", "Chapter two should be the kitchen and the orchard. Ren knows more than she says."),
      message("c2a1", "assistant", PLAN_TWO),
    ]),
    null,
    2,
  ) + "\n",
);

await writeFile(
  path.join(DIR, "chats", "chapter_3_chat.json"),
  JSON.stringify(chat(3, []), null, 2) + "\n",
);

console.log(`Seeded demo book at ${DIR}`);
console.log("Start the mock provider with: npm run mock-ai");
