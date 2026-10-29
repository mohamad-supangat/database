import { fetch } from "bun";
import * as cheerio from "cheerio";
import { Database } from "bun:sqlite";

// Opsi 1: Simpan ke Database SQLite
const db = new Database("dikdas_wilayah.sqlite");

db.run(`
  CREATE TABLE IF NOT EXISTS rekap_dikdas_provinsi (
    kode_provinsi TEXT PRIMARY KEY,
    nama_provinsi TEXT NOT NULL,
    link_detail TEXT,
    total_sd INTEGER,
    total_smp INTEGER,
    total_keseluruhan INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO rekap_dikdas_provinsi (
    kode_provinsi, nama_provinsi, link_detail, total_sd, total_smp, total_keseluruhan
  ) VALUES (
    $kode_provinsi, $nama_provinsi, $link_detail, $total_sd, $total_smp, $total_keseluruhan
  )
`);

async function scrapeDikdasProvinsi() {
  const url = "https://referensi.data.kemendikdasmen.go.id/pendidikan/dikdas";

  console.log("🚀 Mengambil halaman HTML...");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const results: Array<{
      no: number;
      kode_provinsi: string;
      nama_provinsi: string;
      link_detail: string;
      total_sd: number;
      total_smp: number;
      total_keseluruhan: number;
    }> = [];

    // Parse baris dalam tbody tabel #table1
    $("#table1 tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 5) return;

      const no = parseInt($(tds[0]).text().trim(), 10);
      const linkElem = $(tds[1]).find("a");
      const nama_provinsi = linkElem.text().trim();
      const link_detail = linkElem.attr("href") || "";

      // Ekstrak kode provinsi dari URL (contoh: /dikdas/010000/1 -> 010000)
      const matchKode = link_detail.match(/\/dikdas\/(\d+)\//);
      const kode_provinsi = matchKode ? matchKode[1] : "";

      // Parse angka dengan menghapus titik pemisah ribuan
      const parseNum = (str: string) =>
        parseInt(str.replace(/\./g, "").trim(), 10) || 0;

      const total_sd = parseNum($(tds[2]).text());
      const total_smp = parseNum($(tds[3]).text());
      const total_keseluruhan = parseNum($(tds[4]).text());

      if (nama_provinsi) {
        results.push({
          no,
          kode_provinsi,
          nama_provinsi,
          link_detail,
          total_sd,
          total_smp,
          total_keseluruhan,
        });
      }
    });

    // Simpan ke SQLite dalam 1 Transaksi
    const saveToDb = db.transaction((data) => {
      for (const item of data) {
        insertStmt.run({
          $kode_provinsi: item.kode_provinsi,
          $nama_provinsi: item.nama_provinsi,
          $link_detail: item.link_detail,
          $total_sd: item.total_sd,
          $total_smp: item.total_smp,
          $total_keseluruhan: item.total_keseluruhan,
        });
      }
    });

    saveToDb(results);

    console.log(`\n🎉 Berhasil me-scrap ${results.length} data provinsi!\n`);
    console.table(results.slice(0, 5)); // Tampilkan 5 baris pertama di console

    return results;
  } catch (error) {
    console.error("❌ Gagal me-scrap data:", error);
  }
}

scrapeDikdasProvinsi();
