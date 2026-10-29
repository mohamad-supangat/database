import { describe, expect, test } from "bun:test";
import { fetch } from "bun";

const url = "https://database-tau-ten.vercel.app/";

describe("REST API Routes Test", () => {
  test("GET /health - Mengembalikan status OK", async () => {
    const res = await fetch(new Request(`${url}health`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("GET /kodepos/search - Mengembalikan respons pencarian jika parameter q diisi", async () => {
    const res = await fetch(new Request(`${url}kodepos/search?q=jakarta`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const requiredKeys = [
      "city",
      "postalcode",
      "province",
      "subdistrict",
      "urban",
    ];

    body.forEach((item: Record<string, any>) => {
      requiredKeys.forEach((key) => {
        expect(item).toHaveProperty(key);
        expect(item[key]).toBeDefined();
      });
    });
  });

  test("GET /v2/kodepos/search - Mengembalikan respons pencarian kodepos v2", async () => {
    const res = await fetch(new Request(`${url}v2/kodepos/search?q=bandung`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const requiredKeys = [
      "city",
      "postalcode",
      "province",
      "subdistrict",
      "urban",
    ];

    body.forEach((item: Record<string, any>) => {
      requiredKeys.forEach((key) => {
        expect(item).toHaveProperty(key);
        expect(item[key]).toBeDefined();
      });
    });
  });

  test("GET /v1/kodepos/search - Mengembalikan respons pencarian kodepos v1", async () => {
    const res = await fetch(new Request(`${url}v1/kodepos/search?q=surabaya`));
    expect(res.status).toBe(200);

    const body = await res.json();

    const requiredKeys = [
      "city",
      "postalcode",
      "province",
      "subdistrict",
      "urban",
    ];

    body.data.forEach((item: Record<string, any>) => {
      requiredKeys.forEach((key) => {
        expect(item).toHaveProperty(key);
        expect(item[key]).toBeDefined();
      });
    });
  });

  test("GET /sekolah/search - Mengembalikan respons pencarian sekolah", async () => {
    const res = await fetch(new Request(`${url}sekolah/search?q=smkn`));
    expect(res.status).toBe(200);
  });

  test("GET /kodepos/search - Redirect jika query string parameter q kosong", async () => {
    const res = await fetch(new Request(`${url}kodepos/search?q=`), {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://s.id/aurakomputer");
  });

  test("GET /unknown-route - Redirect ke URL fallback untuk rute yang tidak terdaftar", async () => {
    const res = await fetch(new Request(`${url}not-found-route`), {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://s.id/aurakomputer");
  });
});
