import { OG_CONTENT_TYPE, OG_SIZE, ogAlt, stamp } from "@/lib/og";

export const alt = ogAlt("Send a postcard");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return stamp("Send a postcard", "otohime.dev/postcard");
}
