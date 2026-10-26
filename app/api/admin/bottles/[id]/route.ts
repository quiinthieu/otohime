import { bottlePatch } from "@/lib/bottles-http";
import { bottleDeps } from "@/lib/bottles-server";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/bottles/[id]">,
) {
  const { id } = await context.params;
  return bottlePatch(request, id, bottleDeps());
}
