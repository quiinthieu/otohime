import { bottleAdminGet } from "@/lib/bottles-http";
import { bottleDeps } from "@/lib/bottles-server";
export async function GET(request: Request) {
  return bottleAdminGet(request, bottleDeps());
}
