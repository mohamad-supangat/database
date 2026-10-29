import { Database } from "bun:sqlite";
import * as cheerio from "cheerio";

// 1. Inisialisasi Database
const db = new Database("dikdas_wilayah.sqlite");

// Buat Tabel Kecamatan
db.run(`
  CREATE TABLE IF NOT EXISTS rekap_dikdas_kecamatan (
    kode_kecamatan TEXT PRIMARY KEY,
    kode_kabupaten TEXT NOT NULL,
    nama_kecamatan TEXT NOT NULL,
    link_detail TEXT,
    total_sd INTEGER DEFAULT 0,
    total_smp INTEGER DEFAULT 0,
    total_keseluruhan INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_kecamatan_kabupaten ON rekap_dikdas_kecamatan(kode_kabupaten);
`);

// Prepared Statement UPSERT
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO rekap_dikdas_kecamatan (
    kode_kecamatan, kode_kabupaten, nama_kecamatan, link_detail,
    total_sd, total_smp, total_keseluruhan
  ) VALUES (
    $kode_kecamatan, $kode_kabupaten, $nama_kecamatan, $link_detail,
    $total_sd, $total_smp, $total_keseluruhan
  )
`);

const saveBatch = db.transaction((dataList: any[]) => {
  for (const item of dataList) {
    insertStmt.run({
      $kode_kecamatan: item.kode_kecamatan,
      $kode_kabupaten: item.kode_kabupaten,
      $nama_kecamatan: item.nama_kecamatan,
      $link_detail: item.link_detail,
      $total_sd: item.total_sd,
      $total_smp: item.total_smp,
      $total_keseluruhan: item.total_keseluruhan,
    });
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseNum(str: string): number {
  return parseInt(str.replace(/\./g, "").trim(), 10) || 0;
}

// 2. Fungsi Scraping Single Halaman Kabupaten
async function scrapeKabupatenPage(kodeKabupaten: string, targetUrl: string) {
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP Status: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const items: any[] = [];

  $("#table1 tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 5) return;

    const linkElem = $(tds[1]).find("a");
    const nama_kecamatan = linkElem.text().trim();
    const link_detail = linkElem.attr("href") || "";

    // Ekstrak Kode Kecamatan (contoh: /dikdas/010101/3 -> 010101)
    const matchKode = link_detail.match(/\/dikdas\/(\d+)\//);
    const kode_kecamatan = matchKode ? matchKode[1] : "";

    const total_sd = parseNum($(tds[2]).text());
    const total_smp = parseNum($(tds[3]).text());
    const total_keseluruhan = parseNum($(tds[4]).text());

    if (nama_kecamatan && kode_kecamatan) {
      items.push({
        kode_kecamatan,
        kode_kabupaten: kodeKabupaten,
        nama_kecamatan,
        link_detail,
        total_sd,
        total_smp,
        total_keseluruhan,
      });
    }
  });

  return items;
}

// 3. Runner Utama Meloop Seluruh Kabupaten dari DB
async function runScraperKecamatan() {
  const kabList = db
    .query(
      "SELECT kode_kabupaten, nama_kabupaten, link_detail FROM rekap_dikdas_kabupaten",
    )
    .all() as Array<{
    kode_kabupaten: string;
    nama_kabupaten: string;
    link_detail: string;
  }>;

  if (kabList.length === 0) {
    console.error(
      "❌ Data kabupaten tidak ditemukan di DB. Jalankan scraper kabupaten terlebih dahulu.",
    );
    return;
  }

  console.log(
    `🚀 Memulai scraping Kecamatan dari ${kabList.length} Kabupaten/Kota...`,
  );

  const failedKabupaten: string[] = [];

  for (let i = 0; i < kabList.length; i++) {
    const kab = kabList[i];
    console.log(
      `[${i + 1}/${kabList.length}] Scraping ${kab.nama_kabupaten} (${kab.kode_kabupaten})...`,
    );

    try {
      const kecData = await scrapeKabupatenPage(
        kab.kode_kabupaten,
        kab.link_detail,
      );

      if (kecData.length > 0) {
        saveBatch(kecData);
        console.log(`  ✓ Tersimpan ${kecData.length} Kecamatan.`);
      } else {
        console.warn(`  ⚠️ Tidak ada data kecamatan yang ditemukan.`);
      }

      await sleep(350);
    } catch (error) {
      console.error(
        `  ❌ Gagal scraping ${kab.nama_kabupaten}:`,
        error instanceof Error ? error.message : error,
      );
      failedKabupaten.push(kab.nama_kabupaten);
      await sleep(1000);
    }
  }

  console.log("\n🎉 Scraping level Kecamatan selesai!");
  if (failedKabupaten.length > 0) {
    console.log(
      `⚠️ Kabupaten yang dilewati/gagal (${failedKabupaten.length}):`,
      failedKabupaten.join(", "),
    );
  }
}

runScraperKecamatan();
