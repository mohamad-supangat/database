import { kodeposV1, kodeposV2 } from "../controllers/kodepos";
import sekolah from "../controllers/sekolah";
import { isEmpty, realEscapeString } from "../utils/helpers";

export default function handler(req: Request) {
  const currentUrl = new URL(req.url);
  let searchQuery: string = currentUrl.searchParams.get("q")?.toString() ?? "";
  searchQuery = realEscapeString(searchQuery)!;

  if (
    !isEmpty(searchQuery) &&
    (currentUrl.pathname == "/v2/kodepos/search" ||
      currentUrl.pathname == "/kodepos/search")
  ) {
    return kodeposV2(searchQuery);
  }

  if (!isEmpty(searchQuery) && currentUrl.pathname == "/v1/kodepos/search") {
    return kodeposV1(searchQuery);
  }

  if (!isEmpty(searchQuery) && currentUrl.pathname == "/sekolah/search") {
    return sekolah(searchQuery);
  }

  return Response.redirect("https://s.id/aurakomputer");
}
