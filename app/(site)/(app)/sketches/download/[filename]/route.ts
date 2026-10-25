import { connection } from "next/server";
import { handlePortraitDownload } from "@/lib/sketches";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  await connection();
  const { filename } = await params;
  return handlePortraitDownload(request, filename);
}
