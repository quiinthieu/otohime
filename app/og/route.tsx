import { stamp } from "@/lib/og";

// The postmarked card every page shares, whatever its root layout: each root layout (and global-not-found)
// names /og as its Open Graph image against its own metadataBase. It sits outside the route groups, so the
// projects that may not import the site's code still get it. A segment's own opengraph-image file (the site's
// rooms, /postcard) stamps its own title instead.
export function GET() {
  return stamp("Otohime", "Data engineer. Plays games.");
}
