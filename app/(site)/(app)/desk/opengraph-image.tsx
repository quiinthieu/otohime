import { OG_CONTENT_TYPE, OG_SIZE, ogAlt, stamp } from "@/lib/og";

export const alt = ogAlt("Desk");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return stamp("Desk", "otohime.dev/desk");
}
