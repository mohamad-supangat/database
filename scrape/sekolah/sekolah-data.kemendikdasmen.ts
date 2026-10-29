import { Database } from "bun:sqlite";

// 1. Inisialisasi Database SQLite
const db = new Database("sekolah.sqlite");

// Skema Tabel
db.run(`
  CREATE TABLE IF NOT EXISTS sekolah (
    sekolah_id TEXT PRIMARY KEY,
    npsn TEXT,
    nama TEXT NOT NULL,
    bentuk_pendidikan TEXT,
    status_sekolah TEXT,
    akreditasi TEXT,
    provinsi TEXT,
    kabupaten TEXT,
    kecamatan TEXT,
    nama_dusun TEXT,
    alamat_jalan TEXT,
    rt INTEGER,
    rw INTEGER,
    kode_pos TEXT,
    path_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sekolah_npsn ON sekolah(npsn);
  CREATE INDEX IF NOT EXISTS idx_sekolah_wilayah ON sekolah(provinsi, kabupaten, kecamatan);
  CREATE INDEX IF NOT EXISTS idx_sekolah_nama ON sekolah(nama);
`);

// Prepared Statement untuk UPSERT
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO sekolah (
    sekolah_id, npsn, nama, bentuk_pendidikan, status_sekolah,
    akreditasi, provinsi, kabupaten, kecamatan, nama_dusun,
    alamat_jalan, rt, rw, kode_pos, path_file
  ) VALUES (
    $sekolah_id, $npsn, $nama, $bentuk_pendidikan, $status_sekolah,
    $akreditasi, $provinsi, $kabupaten, $kecamatan, $nama_dusun,
    $alamat_jalan, $rt, $rw, $kode_pos, $path_file
  )
`);

// Transaksi Batch Insert
const saveBatch = db.transaction((listSekolah: any[]) => {
  for (const item of listSekolah) {
    insertStmt.run({
      $sekolah_id: item.sekolah_id,
      $npsn: item.npsn,
      $nama: item.nama,
      $bentuk_pendidikan: item.bentuk_pendidikan,
      $status_sekolah: item.status_sekolah,
      $akreditasi: item.akreditasi ?? null,
      $provinsi: item.provinsi,
      $kabupaten: item.kabupaten,
      $kecamatan: item.kecamatan,
      $nama_dusun: item.nama_dusun ?? null,
      $alamat_jalan: item.alamat_jalan ?? null,
      $rt: item.rt ?? null,
      $rw: item.rw ?? null,
      $kode_pos: item.kode_pos ?? null,
      $path_file: item.path_file ?? null,
    });
  }
});

// Pemanggilan API per Halaman
async function fetchSekolahPage(page: number, pageSize: number = 48) {
  const response = await fetch(
    "https://sekolah.data.kemendikdasmen.go.id/v1/sekolah-service/sekolah/cari-sekolah",
    {
      credentials: "include",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "Sec-GPC": "1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        Priority: "u=0",
      },
      referrer: "https://sekolah.data.kemendikdasmen.go.id/sekolah",
      body: JSON.stringify({
        page: page,
        size: pageSize,
        keyword: "",
        kabupaten_kota: "",
        bentuk_pendidikan: "",
        status_sekolah: "",
      }),
      method: "POST",
      mode: "cors",
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP Error Status: ${response.status}`);
  }

  return await response.json();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fungsi Utama Scraper dengan Error Handling per Halaman
async function runScraper() {
  const PAGE_SIZE = 100;
  let currentPage = 0;
  let totalRecords = 0;
  let fetchedRecords = 0;
  const failedPages: number[] = [];

  console.log("🚀 Memulai proses scraping data sekolah...");

  while (true) {
    try {
      console.log(`[Page ${currentPage}] Mengambil data...`);
      const result = await fetchSekolahPage(currentPage, PAGE_SIZE);

      if (!result.data || result.data.length === 0) {
        console.log("Selesai: Tidak ada data lagi yang diterima.");
        break;
      }

      totalRecords = result.total;
      const recordsInPage = result.data.length;

      // Simpan data batch ke SQLite
      saveBatch(result.data);
      fetchedRecords += recordsInPage;

      console.log(
        `✓ [Page ${currentPage}] Berhasil menyimpan ${recordsInPage} data. (` +
          `Progress: ~${fetchedRecords}/${totalRecords})`,
      );

      currentPage++;
      await sleep(300);

      // Berhenti jika estimasi jumlah data yang didapat sudah memenuhi total
      if (fetchedRecords >= totalRecords) {
        break;
      }
    } catch (error) {
      // Menangkap error khusus di halaman ini, mencatatnya, lalu lanjut ke halaman berikutnya
      console.error(
        `⚠️ [Page ${currentPage}] Gagal mengambil/menyimpan data (Dilewati):`,
        error instanceof Error ? error.message : error,
      );

      failedPages.push(currentPage);

      // Lewati halaman yang error dan lanjut ke halaman berikutnya
      currentPage++;

      // Beri jeda lebih lama jika terjadi error untuk recovery koneksi
      await sleep(1000);
    }
  }

  console.log(`\n🎉 Scraping Selesai!`);
  console.log(`Total data terproses: ~${fetchedRecords} sekolah.`);

  if (failedPages.length > 0) {
    console.log(
      `⚠️ Halaman yang dilewati karena error (${failedPages.length}):`,
      failedPages.join(", "),
    );
  }
}

runScraper();
