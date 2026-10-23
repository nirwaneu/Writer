import { describe, expect, it } from "vitest";
import { isSecureRequest } from "@/lib/auth/secure-request";

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("isSecureRequest", () => {
  it("keeps cookies non-secure for plain HTTP LAN access", () => {
    expect(isSecureRequest(request("http://192.168.0.157:3000/login"))).toBe(false);
  });

  it("uses secure cookies for direct HTTPS", () => {
    expect(isSecureRequest(request("https://writer.example.com/login"))).toBe(true);
  });

  it("respects the first forwarded protocol from a proxy", () => {
    expect(
      isSecureRequest(
        request("http://127.0.0.1:3000/login", { "x-forwarded-proto": "https" }),
      ),
    ).toBe(true);
    expect(
      isSecureRequest(
        request("https://127.0.0.1:3000/login", { "x-forwarded-proto": "http" }),
      ),
    ).toBe(false);
    expect(
      isSecureRequest(
        request("http://127.0.0.1:3000/login", { "x-forwarded-proto": "https, http" }),
      ),
    ).toBe(true);
  });
});
