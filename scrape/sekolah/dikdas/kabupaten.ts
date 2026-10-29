import { Database } from "bun:sqlite";
import * as cheerio from "cheerio";

// Inisialisasi Database
const db = new Database("dikdas_wilayah.sqlite");

// 1. Buat Tabel Kabupaten/Kota
db.run(`
  CREATE TABLE IF NOT EXISTS rekap_dikdas_kabupaten (
    kode_kabupaten TEXT PRIMARY KEY,
    kode_provinsi TEXT NOT NULL,
    nama_kabupaten TEXT NOT NULL,
    link_detail TEXT,
    total_sd INTEGER DEFAULT 0,
    total_smp INTEGER DEFAULT 0,
    total_keseluruhan INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_kabupaten_provinsi ON rekap_dikdas_kabupaten(kode_provinsi);
`);

// 2. Prepared Statement UPSERT
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO rekap_dikdas_kabupaten (
    kode_kabupaten, kode_provinsi, nama_kabupaten, link_detail,
    total_sd, total_smp, total_keseluruhan
  ) VALUES (
    $kode_kabupaten, $kode_provinsi, $nama_kabupaten, $link_detail,
    $total_sd, $total_smp, $total_keseluruhan
  )
`);

const saveBatch = db.transaction((dataList: any[]) => {
  for (const item of dataList) {
    insertStmt.run({
      $kode_kabupaten: item.kode_kabupaten,
      $kode_provinsi: item.kode_provinsi,
      $nama_kabupaten: item.nama_kabupaten,
      $link_detail: item.link_detail,
      $total_sd: item.total_sd,
      $total_smp: item.total_smp,
      $total_keseluruhan: item.total_keseluruhan,
    });
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper Parsing Angka (Format 1.234 -> 1234)
function parseNum(str: string): number {
  return parseInt(str.replace(/\./g, "").trim(), 10) || 0;
}

// 3. Fungsi Scraping Single Provinsi
async function scrapeProvinsiPage(kodeProvinsi: string, targetUrl: string) {
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
    const nama_kabupaten = linkElem.text().trim();
    const link_detail = linkElem.attr("href") || "";

    // Ekstrak Kode Kabupaten (contoh: /dikdas/010100/2 -> 010100)
    const matchKode = link_detail.match(/\/dikdas\/(\d+)\//);
    const kode_kabupaten = matchKode ? matchKode[1] : "";

    const total_sd = parseNum($(tds[2]).text());
    const total_smp = parseNum($(tds[3]).text());
    const total_keseluruhan = parseNum($(tds[4]).text());

    if (nama_kabupaten && kode_kabupaten) {
      items.push({
        kode_kabupaten,
        kode_provinsi: kodeProvinsi,
        nama_kabupaten,
        link_detail,
        total_sd,
        total_smp,
        total_keseluruhan,
      });
    }
  });

  return items;
}

// 4. Runner Utama untuk Semua Provinsi
async function runScraperKabupaten() {
  // Ambil daftar provinsi dari DB
  const provList = db
    .query(
      "SELECT kode_provinsi, nama_provinsi, link_detail FROM rekap_dikdas_provinsi",
    )
    .all() as Array<{
    kode_provinsi: string;
    nama_provinsi: string;
    link_detail: string;
  }>;

  if (provList.length === 0) {
    console.error(
      "❌ Data provinsi tidak ditemukan di DB. Jalankan scraper provinsi terlebih dahulu.",
    );
    return;
  }

  console.log(
    `🚀 Memulai scraping Kabupaten/Kota dari ${provList.length} provinsi...`,
  );

  const failedProvinces: string[] = [];

  for (let i = 0; i < provList.length; i++) {
    const prov = provList[i];
    console.log(
      `[${i + 1}/${provList.length}] Scraping ${prov.nama_provinsi} (${prov.kode_provinsi})...`,
    );

    try {
      const kabData = await scrapeProvinsiPage(
        prov.kode_provinsi,
        prov.link_detail,
      );

      if (kabData.length > 0) {
        saveBatch(kabData);
        console.log(`  ✓ Tersimpan ${kabData.length} Kabupaten/Kota.`);
      } else {
        console.warn(`  ⚠️ Tidak ada data kabupaten/kota yang ditemukan.`);
      }

      // Delay antar-request
      await sleep(400);
    } catch (error) {
      console.error(
        `  ❌ Gagal scraping ${prov.nama_provinsi}:`,
        error instanceof Error ? error.message : error,
      );
      failedProvinces.push(prov.nama_provinsi);
      await sleep(1000);
    }
  }

  console.log("\n🎉 Scraping Kabupaten/Kota selesai!");
  if (failedProvinces.length > 0) {
    console.log(
      `⚠️ Provinsi yang dilewati/gagal (${failedProvinces.length}):`,
      failedProvinces.join(", "),
    );
  }
}

runScraperKabupaten();
