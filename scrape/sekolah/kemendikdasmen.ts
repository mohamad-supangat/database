import { chromium } from "playwright";
import { load as cheerioLoad } from "cheerio";
import type { Sekolah } from "../../utils/types";
import { db } from "../../controllers/sekolah";
const baseUrl = "https://data.kemendikdasmen.go.id";
const browser = await chromium.launch({
  headless: false,
  args: ["--ozone-platform=wayland", "--enable-features=UseOzonePlatform"],
});

const page = await browser.newPage();
await page.goto(`${baseUrl}/data-induk/satpen`, {
  waitUntil: "networkidle",
});

const content = await page.evaluate(() => document.body.innerHTML);
const $ = cheerioLoad(content);

const keys = [
  "#",
  "npsn",
  "nama",
  "bentuk",
  "jenis",
  "alamat",
  "kelurahan",
  "status",
];

function scrape(content: string) {
  for (const $sekolah of $(content).find(".psdContainer table tbody tr")) {
    const td = $($sekolah).find("td");
    const result: Sekolah = {};

    td.each((index, data) => {
      const value = $(data).text().trim();
      result[keys[index]] = value;
    });

    if (Object.entries(result).length === keys.length) {
      if (Object.entries(result).length === keys.length) {
        let { npsn, nama, bentuk, jenis, alamat, kelurahan, status } = result;

        // Ensure NPSN exists as it's likely the primary key
        if (npsn) {
          try {
            db.prepare(
              `INSERT OR REPLACE INTO sekolah (
              npsn,
              nama,
              bentuk,
              jenis,
              alamat,
              kelurahan,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ).run(npsn, nama, bentuk, jenis, alamat, kelurahan, status);
            console.log(
              `Sekolah ${nama} : ${alamat} saved/updated successfully.`,
            );
          } catch (error) {
            console.error(`Error processing sekolah ${npsn}:`, error);
          }
        } else {
          console.warn("Skipping record due to missing NPSN:", result);
        }
      }
    }
  }
}

for (const $provinsi of $("a.province")) {
  const $provinsiUrl = $($provinsi).attr("href");
  await page.goto(`${baseUrl}${$provinsiUrl}`, {
    waitUntil: "networkidle",
  });
  const content = await page.evaluate(() => document.body.innerHTML);

  // masuk kabupaten
  for (const $kabupaten of $(content).find(
    ".psdContainer a[type='button'].text-center",
  )) {
    const $kabupatenUrl = $($kabupaten).attr("href");
    await page.goto(`${baseUrl}${$kabupatenUrl}`, {
      waitUntil: "networkidle",
    });
    const content = await page.evaluate(() => document.body.innerHTML);

    //kecamatan
    for (const $kecamatan of $(content).find(
      ".psdContainer a[type='button'].text-center",
    )) {
      const $kecamatanUrl = $($kecamatan).attr("href");
      await page.goto(`${baseUrl}${$kecamatanUrl}`, {
        waitUntil: "networkidle",
      });

      // Loop through pages for the current kecamatan
      while (true) {
        // Get the current page's HTML content
        const pageContent = await page.evaluate(() => document.body.innerHTML);

        if ($(pageContent).find(".psdContainer table tbody tr").length === 0) {
          break;
        }

        scrape(pageContent); // Scrape data from the current page

        // Selector for the "Next Page" button, based on the provided sample HTML
        const nextPageButtonSelector = "ul li button[title='Next Page']";

        // Use Playwright's locator to find the next button
        const nextButton = page.locator(nextPageButtonSelector);

        // Check if the next button is visible and not disabled
        const isNextButtonDisabled = await nextButton.isDisabled();
        const isNextButtonVisible = await nextButton.isVisible();

        if (!isNextButtonVisible || isNextButtonDisabled) {
          break;
        }

        try {
          // Click the next page button
          await nextButton.click();
          // Wait for the page to load new content after the click
          await page.waitForLoadState("networkidle"); // Wait until the network is idle, indicating page content has loaded
        } catch (error) {
          // Log an error if clicking fails (e.g., button disappears unexpectedly)
          console.warn(
            `Error clicking next page button for URL ${page.url()}:`,
            error,
          );
          break; // Exit the loop if an error occurs
        }
      }
    }
  }
}

await browser.close();
