import type { Chat, ChatAlternative, ChatMessage } from "@/lib/schemas";
import { AppError } from "@/lib/errors";

export function alternativesFor(message: ChatMessage): ChatAlternative[] {
  if (message.alternatives?.length) return message.alternatives;
  return [
    {
      id: message.id,
      content: message.content,
      ...(message.reasoning ? { reasoning: message.reasoning } : {}),
      createdAt: message.createdAt,
      ...(message.model ? { model: message.model } : {}),
      ...(message.failed ? { failed: true } : {}),
    },
  ];
}

function withActiveAlternative(
  message: ChatMessage,
  alternatives: ChatAlternative[],
  activeId: string,
): ChatMessage {
  const active =
    alternatives.find((alternative) => alternative.id === activeId) ?? alternatives[0];
  return {
    ...message,
    alternatives,
    activeAlternativeId: active.id,
    content: active.content,
    ...(active.reasoning ? { reasoning: active.reasoning } : { reasoning: undefined }),
    ...(active.model ? { model: active.model } : {}),
    ...(active.failed ? { failed: true } : { failed: undefined }),
  };
}

function findMessage(chat: Chat, messageId: string): { index: number; message: ChatMessage } {
  const index = chat.messages.findIndex((message) => message.id === messageId);
  if (index < 0) throw new AppError("NOT_FOUND", "That message no longer exists.", { status: 404 });
  return { index, message: chat.messages[index] };
}

export function switchMessageVersion(
  chat: Chat,
  messageId: string,
  alternativeId: string,
): Chat {
  const { message } = findMessage(chat, messageId);
  if (message.role !== "assistant") {
    throw new AppError("BAD_REQUEST", "Only assistant responses have versions.", { status: 400 });
  }
  const alternatives = alternativesFor(message);
  if (!alternatives.some((alternative) => alternative.id === alternativeId)) {
    throw new AppError("BAD_REQUEST", "That response version does not exist.", { status: 400 });
  }
  const next = withActiveAlternative(message, alternatives, alternativeId);
  return {
    ...chat,
    messages: chat.messages.map((item) => (item.id === messageId ? next : item)),
    updatedAt: new Date().toISOString(),
  };
}

export function addAssistantAlternative(
  chat: Chat,
  messageId: string,
  alternative: ChatAlternative,
): Chat {
  const { message } = findMessage(chat, messageId);
  if (message.role !== "assistant") {
    throw new AppError("BAD_REQUEST", "Only assistant responses have versions.", { status: 400 });
  }
  const alternatives = [...alternativesFor(message), alternative];
  const next = withActiveAlternative(message, alternatives, alternative.id);
  return {
    ...chat,
    messages: chat.messages.map((item) => (item.id === messageId ? next : item)),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteMessageVersion(chat: Chat, messageId: string): Chat {
  const { index, message } = findMessage(chat, messageId);
  if (message.role !== "assistant") {
    throw new AppError("BAD_REQUEST", "Only assistant responses can be deleted by version.", {
      status: 400,
    });
  }
  const alternatives = alternativesFor(message);
  const activeIndex = Math.max(
    0,
    alternatives.findIndex((alternative) => alternative.id === message.activeAlternativeId),
  );
  const remaining = alternatives.filter((_, position) => position !== activeIndex);

  if (!remaining.length) {
    return {
      ...chat,
      messages: chat.messages.filter((_, position) => position !== index),
      updatedAt: new Date().toISOString(),
    };
  }

  const nextActive = remaining[Math.min(activeIndex, remaining.length - 1)];
  const next = withActiveAlternative(message, remaining, nextActive.id);
  return {
    ...chat,
    messages: chat.messages.map((item) => (item.id === messageId ? next : item)),
    updatedAt: new Date().toISOString(),
  };
}

export function editUserMessage(chat: Chat, messageId: string, content: string): Chat {
  const { index, message } = findMessage(chat, messageId);
  if (message.role !== "user") {
    throw new AppError("BAD_REQUEST", "Only user messages can be edited.", { status: 400 });
  }
  const trimmed = content.trim();
  if (!trimmed) {
    throw new AppError("BAD_REQUEST", "The message is empty.", { status: 400 });
  }
  return {
    ...chat,
    messages: [
      ...chat.messages.slice(0, index),
      { ...message, content: trimmed },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function editAssistantMessage(chat: Chat, messageId: string, content: string): Chat {
  const { message } = findMessage(chat, messageId);
  if (message.role !== "assistant") {
    throw new AppError("BAD_REQUEST", "Only Planner responses can be edited here.", {
      status: 400,
    });
  }
  const trimmed = content.trim();
  if (!trimmed) {
    throw new AppError("BAD_REQUEST", "The message is empty.", { status: 400 });
  }
  const alternatives = alternativesFor(message);
  const activeId = message.activeAlternativeId ?? alternatives[0].id;
  const nextAlternatives = alternatives.map((alternative) =>
    alternative.id === activeId ? { ...alternative, content: trimmed } : alternative,
  );
  const next = withActiveAlternative(message, nextAlternatives, activeId);
  return {
    ...chat,
    messages: chat.messages.map((item) => (item.id === messageId ? next : item)),
    updatedAt: new Date().toISOString(),
  };
}

export function updateAssistantAlternative(
  chat: Chat,
  messageId: string,
  partial: ChatAlternative,
): Chat {
  const { message } = findMessage(chat, messageId);
  const alternatives = alternativesFor(message).map((alternative) =>
    alternative.id === partial.id ? { ...alternative, ...partial } : alternative,
  );
  const next = withActiveAlternative(
    message,
    alternatives,
    message.activeAlternativeId ?? alternatives[0].id,
  );
  return {
    ...chat,
    messages: chat.messages.map((item) => (item.id === messageId ? next : item)),
    updatedAt: new Date().toISOString(),
  };
}
