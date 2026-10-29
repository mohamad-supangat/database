import { Database } from "bun:sqlite";
import * as cheerio from "cheerio";

// 1. Inisialisasi Database
const db = new Database("dikdas_wilayah.sqlite");

// Buat Tabel Sekolah
db.run(`
  CREATE TABLE IF NOT EXISTS referensi_sekolah (
    npsn TEXT PRIMARY KEY,
    kode_kecamatan TEXT NOT NULL,
    nama_sekolah TEXT NOT NULL,
    alamat TEXT,
    kelurahan TEXT,
    status TEXT,
    link_detail TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sekolah_kecamatan ON referensi_sekolah(kode_kecamatan);
  CREATE INDEX IF NOT EXISTS idx_sekolah_nama ON referensi_sekolah(nama_sekolah);
`);

// Prepared Statement UPSERT
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO referensi_sekolah (
    npsn, kode_kecamatan, nama_sekolah, alamat, kelurahan, status, link_detail
  ) VALUES (
    $npsn, $kode_kecamatan, $nama_sekolah, $alamat, $kelurahan, $status, $link_detail
  )
`);

const saveBatch = db.transaction((dataList: any[]) => {
  for (const item of dataList) {
    insertStmt.run({
      $npsn: item.npsn,
      $kode_kecamatan: item.kode_kecamatan,
      $nama_sekolah: item.nama_sekolah,
      $alamat: item.alamat,
      $kelurahan: item.kelurahan,
      $status: item.status,
      $link_detail: item.link_detail,
    });
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 2. Fungsi Scraping Single Halaman Kecamatan
async function scrapeKecamatanPage(kodeKecamatan: string, targetUrl: string) {
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
    if (tds.length < 6) return;

    const linkElem = $(tds[1]).find("a");
    const npsn = linkElem.text().trim();
    const link_detail = linkElem.attr("href") || "";

    const nama_sekolah = $(tds[2]).text().trim();
    const alamat = $(tds[3]).text().trim();
    const kelurahan = $(tds[4]).text().trim();
    const status = $(tds[5]).text().trim();

    if (npsn && nama_sekolah) {
      items.push({
        npsn,
        kode_kecamatan: kodeKecamatan,
        nama_sekolah,
        alamat,
        kelurahan,
        status,
        link_detail,
      });
    }
  });

  return items;
}

// 3. Runner Utama Meloop Seluruh Kecamatan dari DB
async function runScraperSekolah() {
  const kecList = db
    .query(
      "SELECT kode_kecamatan, nama_kecamatan, link_detail FROM rekap_dikdas_kecamatan",
    )
    .all() as Array<{
    kode_kecamatan: string;
    nama_kecamatan: string;
    link_detail: string;
  }>;

  if (kecList.length === 0) {
    console.error(
      "❌ Data kecamatan tidak ditemukan di DB. Jalankan scraper kecamatan terlebih dahulu.",
    );
    return;
  }

  console.log(
    `🚀 Memulai scraping daftar sekolah dari ${kecList.length} Kecamatan...`,
  );

  const failedKecamatan: string[] = [];

  for (let i = 0; i < kecList.length; i++) {
    const kec = kecList[i];
    console.log(
      `[${i + 1}/${kecList.length}] Scraping ${kec.nama_kecamatan} (${kec.kode_kecamatan})...`,
    );

    try {
      const sekolahData = await scrapeKecamatanPage(
        kec.kode_kecamatan,
        kec.link_detail,
      );

      if (sekolahData.length > 0) {
        saveBatch(sekolahData);
        console.log(`  ✓ Tersimpan ${sekolahData.length} sekolah.`);
      } else {
        console.warn(`  ⚠️ Tidak ada data sekolah yang ditemukan.`);
      }

      await sleep(350);
    } catch (error) {
      console.error(
        `  ❌ Gagal scraping ${kec.nama_kecamatan}:`,
        error instanceof Error ? error.message : error,
      );
      failedKecamatan.push(kec.nama_kecamatan);
      await sleep(1000);
    }
  }

  console.log("\n🎉 Scraping seluruh data sekolah selesai!");
  if (failedKecamatan.length > 0) {
    console.log(
      `⚠️ Kecamatan yang dilewati/gagal (${failedKecamatan.length}):`,
      failedKecamatan.join(", "),
    );
  }
}

runScraperSekolah();
