import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiClientError, clearAuthTokens, getAccessToken, getApiBaseUrl, setAuthTokens } from "@/lib/api";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("stores and clears auth tokens", () => {
    setAuthTokens("access-token", "refresh-token");
    expect(getAccessToken()).toBe("access-token");
    expect(localStorage.getItem("irms.refresh_token")).toBe("refresh-token");

    clearAuthTokens();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem("irms.refresh_token")).toBeNull();
  });

  it("sends bearer auth and json body for authenticated requests", async () => {
    setAuthTokens("access-token");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { id: "order-1" },
      }),
    );

    const result = await api.post<{ id: string }>("/orders", { table_id: "table-1" });

    expect(result).toEqual({ id: "order-1" });
    expect(fetch).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/orders`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ table_id: "table-1" }),
      }),
    );

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("can send unauthenticated requests when auth is disabled", async () => {
    setAuthTokens("access-token");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { access_token: "next-token" },
      }),
    );

    await api.post("/auth/login", { email: "staff@example.com" }, { auth: false });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("throws structured errors from failed API responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          data: null,
          error: {
            code: "ORDER_TOTAL_UNPAID",
            message: "Payment amount is below order total",
            details: { minimum: 42 },
          },
        },
        { status: 400 },
      ),
    );

    await expect(api.post("/billing/orders/order-1/payments", { amount: 10 })).rejects.toMatchObject<
      Partial<ApiClientError>
    >({
      name: "ApiClientError",
      message: "Payment amount is below order total",
      code: "ORDER_TOTAL_UNPAID",
      details: { minimum: 42 },
      status: 400,
    });
  });

  it("throws a fallback error when the response is not json", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }));

    await expect(api.get("/dashboard/summary")).rejects.toMatchObject({
      message: "Request failed with status 503",
      status: 503,
    });
  });
});
