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

-- Indeks untuk mempercepat pencarian/query
CREATE INDEX IF NOT EXISTS idx_sekolah_npsn ON sekolah (npsn);
CREATE INDEX IF NOT EXISTS idx_sekolah_wilayah ON sekolah (
    provinsi, kabupaten, kecamatan
);
CREATE INDEX IF NOT EXISTS idx_sekolah_nama ON sekolah (nama);
