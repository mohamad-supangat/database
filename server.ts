import { kodeposV1, kodeposV2 } from "./controllers/kodepos";
import sekolah from "./controllers/sekolah";
import { isEmpty, realEscapeString } from "./utils/helpers";

const handleSearch = (req: Request, handler: (query: string) => any) => {
  const currentUrl = new URL(req.url);
  const rawSearch = currentUrl.searchParams.get("q") ?? "";
  const searchQuery = realEscapeString(rawSearch.toString());

  if (!isEmpty(searchQuery || "")) {
    return handler(searchQuery!);
  }

  return Response.redirect("https://s.id/aurakomputer");
};

const server = Bun.serve({
  routes: {
    "/health": () => Response.json({ status: "ok" }),
    "/kodepos/search": (req) => handleSearch(req, kodeposV2),
    "/v2/kodepos/search": (req) => handleSearch(req, kodeposV2),
    "/v1/kodepos/search": (req) => handleSearch(req, kodeposV1),
    "/sekolah/search": (req) => handleSearch(req, sekolah),
  },
  // Fallback (catch-all) jika tidak ada rute yang cocok
  fetch(req) {
    return Response.redirect("https://s.id/aurakomputer");
  },
});

console.log(`Listening on ${server.url}`);
