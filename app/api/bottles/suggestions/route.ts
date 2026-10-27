import { bottlePost } from "@/lib/bottles-http";
import { bottleDeps } from "@/lib/bottles-server";
export async function POST(request: Request) {
  return bottlePost(request, bottleDeps());
}
