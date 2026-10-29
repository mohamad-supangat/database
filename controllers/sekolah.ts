import { Database } from "bun:sqlite";
import path from "path";


const dbPath = path.join(process.cwd(), "sekolah.sqlite");
const db = new Database(dbPath, { readonly: true });

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
