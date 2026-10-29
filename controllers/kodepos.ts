import { Database } from "bun:sqlite";

export const db = new Database("../nusa.sqlite");

function getKodeposDB(searchQuery: string) {
  const query = `
    SELECT
      v.name AS urban,
      v.postal_code AS postalcode,
      d.name AS subdistrict,
      r.name AS city,
      p.name AS province
    FROM villages v
    JOIN districts d ON v.district_code = d.code
    JOIN regencies r ON v.regency_code = r.code
    JOIN provinces p ON v.province_code = p.code
    WHERE
      p.name LIKE $search
      OR r.name LIKE $search
      OR d.name LIKE $search
      OR v.name LIKE $search
      OR v.postal_code LIKE $search
  `;

  return db.query(query).all({ $search: `%${searchQuery}%` });
}

export function kodeposV2(searchQuery: string) {
  const rows = getKodeposDB(searchQuery);
  return Response.json(rows, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}

export function kodeposV1(searchQuery: string) {
  const rows = getKodeposDB(searchQuery);
  return Response.json(
    {
      statusCode: 200,
      code: "OK",
      data: rows,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    },
  );
}
