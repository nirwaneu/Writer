import { AppError } from "@/lib/errors";

export type ResolvedEndpoints = {
  chat: string;
  models: string;
};

export function resolveEndpoints(input: string): ResolvedEndpoints {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AppError("BAD_REQUEST", "Enter a valid http(s) endpoint.", { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("BAD_REQUEST", "The endpoint must start with http:// or https://.", {
      status: 400,
    });
  }
  url.hash = "";
  url.search = "";

  let pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/chat/completions")) {
    const base = pathname.slice(0, -"/chat/completions".length);
    return {
      chat: build(url, `${base}/chat/completions`),
      models: build(url, `${base}/models`),
    };
  }

  if (pathname.endsWith("/completions")) {
    const base = pathname.slice(0, -"/completions".length);
    return {
      chat: build(url, `${base}/chat/completions`),
      models: build(url, `${base}/models`),
    };
  }

  if (pathname === "" || pathname === "/") {
    pathname = "/v1";
  }

  return {
    chat: build(url, `${pathname}/chat/completions`),
    models: build(url, `${pathname}/models`),
  };
}

function build(url: URL, pathname: string): string {
  const next = new URL(url.toString());
  next.pathname = pathname;
  return next.toString();
}

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}
