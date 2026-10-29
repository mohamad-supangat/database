import { Database } from "bun:sqlite";

export const db = new Database("sekolah.sqlite");

export default function sekolah(searchQuery: string) {
  const rows = db
    .query(
      `
      SELECT *
      FROM sekolah
      WHERE
        nama LIKE "%${searchQuery}%"
        OR alamat LIKE "%${searchQuery}%"
        OR npsn LIKE "%${searchQuery}%"
        OR status LIKE "%${searchQuery}%"
      `,
    )
    .all();

  return Response.json(rows, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
