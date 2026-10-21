// The Gazette's first edition as data: six short pieces on everyday science,
// in front-page order, the lead first. Plain text only (no HTML, no markdown),
// so the tests can read it: every body is 180 to 350 words at a reading grade
// of 8 or under, and every number in it is one of the article's facts, each
// naming a source on the allowlist. The figures draw from the same facts, so a
// number cannot differ between the text and the picture.

export type SourceKey = string;
export type Fact = { id: string; label: string; value: string; source: SourceKey };
export type Source = { title: string; url: string };
export type Kicker = "Sky" | "Calendar" | "Numbers" | "Earth";
export type Article = {
  slug: string; // [a-z-]+, the URL and the figure's file name
  kicker: Kicker;
  headline: string; // ≤ 8 words
  deck: string; // one sentence, ≤ 30 words
  published: string; // YYYY-MM-DD
  body: readonly string[]; // paragraphs: 180 to 350 words in all, none over 90
  facts: readonly Fact[]; // the numbers the text and the figure use, each sourced
  sources: Record<SourceKey, Source>; // ≥ 2, https on the allowlist
  figure: { caption: string; alt: string };
};

// https only, on these hosts or their subdomains: the places a reader can check us.
export const SOURCE_HOSTS = ["en.wikipedia.org", "nasa.gov", "noaa.gov", "www.gps.gov", "usgs.gov", "nist.gov"] as const;
const EXACT = new Set(["en.wikipedia.org", "www.gps.gov"]);

export function allowedSource(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  return SOURCE_HOSTS.some((h) => (EXACT.has(h) ? u.hostname === h : u.hostname === h || u.hostname.endsWith(`.${h}`)));
}

const PUBLISHED = "2026-10-21";
const wiki = (page: string, title: string): Source => ({ title: `Wikipedia: ${title}`, url: `https://en.wikipedia.org/wiki/${page}` });

const SKY: Article = {
  slug: "why-the-sky-is-blue",
  kicker: "Sky",
  headline: "Why the sky is blue",
  deck: "Sunlight holds every colour, and the air bounces the blue part all over the sky.",
  published: PUBLISHED,
  body: [
    "Look up on a clear day and the sky is blue. Yet the light that fills it comes from the Sun, and sunlight is white. White light is every colour mixed together. A rainbow shows this, because it pulls the colours apart.",
    "Light moves in waves. Each colour has its own wavelength, the gap from the top of one wave to the top of the next. Blue light has short waves, about 450 nanometres long. A nanometre is a millionth of a millimetre. Red light has longer waves, about 700 nanometres.",
    "Air is made of tiny bits called molecules, far smaller than a wave of light. When light hits one, some of it bounces off in a new direction. This is called scattering. Short waves scatter much more than long ones. Make a wave half as long and it scatters sixteen times as much.",
    "So blue light scatters about 5.9 times as much as red. As sunlight crosses the air, blue light is thrown all over the sky. Wherever you look, some of that blue reaches your eyes. Red and yellow light mostly go straight on.",
    "Violet waves are shorter still, so why is the sky not violet? The Sun sends out less violet light than blue, and our eyes are less able to see it. Blue wins.",
    "At sunset the Sun is low. Its light must cross much more air to reach you. On the way, most of the blue is scattered off to the side. What is left is the orange and red light that paints the evening sky.",
  ],
  facts: [
    { id: "blue", label: "Blue light's wavelength", value: "450 nm", source: "spectrum" },
    { id: "red", label: "Red light's wavelength", value: "700 nm", source: "spectrum" },
    { id: "law", label: "Scattering grows as one over the wavelength to the fourth power", value: "1/λ⁴", source: "rayleigh" },
    { id: "ratio", label: "How much more blue scatters than red, (700/450)⁴", value: "5.9×", source: "rayleigh" },
  ],
  sources: {
    rayleigh: wiki("Rayleigh_scattering", "Rayleigh scattering"),
    spectrum: wiki("Visible_spectrum", "Visible spectrum"),
    spaceplace: { title: "NASA Space Place: Why is the sky blue?", url: "https://spaceplace.nasa.gov/blue-sky/en/" },
  },
  figure: {
    caption: "Air scatters short blue waves about 5.9 times as much as long red ones; at sunset the light crosses so much air that mostly red is left.",
    alt: "At noon a sunbeam enters the air and blue arrows scatter in every direction while red light goes straight on to a person; at sunset a low beam crosses a longer path through the air.",
  },
};

const LEAP: Article = {
  slug: "why-we-need-a-leap-day",
  kicker: "Calendar",
  headline: "Why February gets a 29th",
  deck: "The Earth takes a little more than 365 days to go round the Sun, and an extra day every four years keeps the calendar in step.",
  published: PUBLISHED,
  body: [
    "A year is the time the Earth takes to go once round the Sun, from one spring to the next. That takes about 365.2422 days. It is not a whole number of days, and that small extra bit causes all the trouble.",
    "A normal calendar year has 365 days. So each year the calendar ends a bit too soon, by 0.2422 of a day. That is nearly six hours. After four years the calendar is almost a whole day behind the Sun.",
    "The fix is to add one day every fourth year, on February 29. A year with this extra day is called a leap year. It pulls the calendar back in line with the seasons.",
    "But the true gap is a little less than a quarter of a day. Adding a whole day every four years is slightly too much, and over time the calendar would run ahead.",
    "So there is a second rule. A year that divides by 4 is a leap year. A year that divides by 100 is not, unless it also divides by 400. So 2000 was a leap year, but 1900 was not.",
    "That gives 97 leap days in every 400 years. The average calendar year comes out at 365.2425 days, very close to the real one. Without leap days, the seasons would slide by about 24 days every hundred years. In time, July would come in the middle of winter for people in the north.",
  ],
  facts: [
    { id: "year", label: "One trip round the Sun, spring to spring (the tropical year)", value: "365.2422 days", source: "tropical" },
    { id: "calendar", label: "A normal calendar year", value: "365 days", source: "leap" },
    { id: "short", label: "How much a normal year falls short", value: "0.2422 day", source: "tropical" },
    { id: "leap", label: "The leap day", value: "29 February", source: "leap" },
    { id: "rule", label: "The Gregorian rule: divides by 4, not by 100, yes by 400", value: "4, not 100, yes 400", source: "gregorian" },
    { id: "count", label: "Leap days in each 400 years", value: "97 leap days in 400 years", source: "gregorian" },
    { id: "mean", label: "The average Gregorian year", value: "365.2425 days", source: "gregorian" },
    { id: "y1900", label: "1900 divides by 100 but not by 400", value: "1900: no", source: "leap" },
    { id: "y2000", label: "2000 divides by 400", value: "2000: yes", source: "leap" },
    { id: "drift", label: "Drift without leap days, 0.2422 × 100", value: "24 days", source: "tropical" },
  ],
  sources: {
    leap: wiki("Leap_year", "Leap year"),
    gregorian: wiki("Gregorian_calendar", "Gregorian calendar"),
    tropical: wiki("Tropical_year", "Tropical year"),
  },
  figure: {
    caption: "Each year the calendar falls 0.2422 of a day short; one leap day every four years, skipped on most century years, keeps the average at 365.2425 days.",
    alt: "Four year-bars, each with a small red sliver of 0.2422 day at the end, add up to one leap day on 29 February; below, a 400-year ruler from 1600 to 2000 holds 97 leap days, with 1900 skipped and 2000 kept.",
  },
};

const GPS: Article = {
  slug: "how-your-phone-knows-where-it-is",
  kicker: "Numbers",
  headline: "How your phone knows where it is",
  deck: "Your phone listens to clocks in space and turns how late their signals arrive into distances.",
  published: PUBLISHED,
  body: [
    "Open a map on your phone and a dot shows where you stand. The phone works this out by listening to satellites. It does not send anything back to them. It only listens.",
    "There are about 31 working GPS satellites. They circle the Earth about 20,200 kilometres up, twice a day. Each one carries a very exact clock. Over and over, each one sends out a signal that says which satellite it is and what time it is.",
    "Radio signals travel at the speed of light, but even light takes time to cross that gap. The phone notes how late each signal arrives. The delay tells it how far away that satellite is.",
    "One distance is not enough. It only says you are somewhere on a huge circle around that satellite. Add a second satellite and the two circles cross at two points. A third circle picks out just one of them. That point is you.",
    "Then why does a phone need 4 satellites? The clock inside a phone is cheap and a little off. Because light is so fast, a tiny clock error turns into a big error in distance. The fourth signal lets the phone fix its own clock while it works out where it is.",
    "Out in the open, a phone is usually right to within about 5 metres. Tall buildings and trees block and bounce the signals, so in a city the dot can wander.",
  ],
  facts: [
    { id: "count", label: "Working GPS satellites", value: "about 31", source: "space" },
    { id: "height", label: "How high they fly", value: "20,200 km", source: "space" },
    { id: "needed", label: "Satellites needed for a fix and a clock", value: "4 satellites", source: "gpswiki" },
    { id: "accuracy", label: "A phone's accuracy under open sky", value: "about 5 m", source: "accuracy" },
  ],
  sources: {
    space: { title: "GPS.gov: Space segment", url: "https://www.gps.gov/systems/gps/space/" },
    accuracy: { title: "GPS.gov: GPS accuracy", url: "https://www.gps.gov/systems/gps/performance/accuracy/" },
    gpswiki: wiki("Global_Positioning_System", "Global Positioning System"),
  },
  figure: {
    caption: "Three distances cross at one point; a fourth satellite corrects the phone's clock.",
    alt: "Three satellites high above the Earth, each with a circle of distance; the three circles meet at the phone, and a fourth satellite carries a clock.",
  },
};

const GIGABYTE: Article = {
  slug: "what-a-gigabyte-holds",
  kicker: "Numbers",
  headline: "What a gigabyte holds",
  deck: "Each step from kilobyte to terabyte is a thousand times bigger, and everyday things sit on every rung.",
  published: PUBLISHED,
  body: [
    "Everything a computer stores is made of bits. A bit is a tiny switch that is either on or off. Put 8 bits together and you have a byte. One byte can hold one letter, like a single A.",
    "Bytes add up fast, so we use bigger units. Each step up is a thousand times the one before. A kilobyte is 1,000 bytes. A megabyte is 1,000 kilobytes. A gigabyte is 1,000 megabytes, and a terabyte is 1,000 gigabytes.",
    "Real things help to picture this ladder. A page of plain text has about 2,000 letters, so it fills about 2 kilobytes. A whole book of 500 pages fits in about 1 megabyte. A film on a DVD takes about 4.7 gigabytes. A 1 terabyte drive could hold about 200 of those films.",
    "There is a catch. Computers count in twos, not tens. So to a computer, a kilobyte is often 1,024 bytes, not 1,000. At each step up the ladder, the gap grows. A drive sold as 1 terabyte shows up on a computer as about 931 gigabytes. No space has gone missing. The shop and the computer are just using different units.",
    "Next time your phone says it is full, think of the ladder. A few films take far more room than thousands of pages of notes. Photos and videos are what fill a phone, not words.",
  ],
  facts: [
    { id: "bits", label: "Bits in a byte", value: "8 bits", source: "byte" },
    { id: "step", label: "Each step up the ladder", value: "×1,000", source: "gigabyte" },
    { id: "letters", label: "Letters on a page of plain text", value: "2,000 letters", source: "megabyte" },
    { id: "page", label: "A page of plain text", value: "2 KB", source: "megabyte" },
    { id: "pages", label: "Pages in a book of about a megabyte", value: "500 pages", source: "megabyte" },
    { id: "book", label: "A 500-page book in plain text", value: "1 MB", source: "megabyte" },
    { id: "film", label: "A film on a single-layer DVD", value: "4.7 GB", source: "dvd" },
    { id: "films", label: "DVD films on a 1 TB drive, 1,000 ÷ 4.7", value: "200 films", source: "dvd" },
    { id: "binary", label: "A kilobyte, counted in twos", value: "1,024", source: "binary" },
    { id: "shown", label: "A 1 TB drive as a computer counts it, 10¹² ÷ 1,024³", value: "931 GB", source: "gigabyte" },
  ],
  sources: {
    byte: wiki("Byte", "Byte"),
    megabyte: wiki("Megabyte", "Megabyte"),
    gigabyte: wiki("Gigabyte", "Gigabyte"),
    dvd: wiki("DVD", "DVD"),
    binary: { title: "NIST: Prefixes for binary multiples", url: "https://physics.nist.gov/cuu/Units/binary.html" },
  },
  figure: {
    caption: "Every rung is a thousand times the one below, from a letter to a drive of films; counted in twos, the top rung comes up short.",
    alt: "A ladder of five rungs, byte, kilobyte, megabyte, gigabyte and terabyte, each a thousand times the last, with a letter, a page, a book, a DVD and a drive beside them; a red sliver on the top rung marks the gap between 1,000 and 1,024.",
  },
};

const ICE: Article = {
  slug: "why-ice-floats",
  kicker: "Earth",
  headline: "Why ice floats",
  deck: "Water grows when it freezes, so ice is lighter than the water around it and lakes freeze from the top down.",
  published: PUBLISHED,
  body: [
    "Drop an ice cube into a glass of water and it bobs at the top. That seems normal, but it is odd. Most liquids shrink when they freeze, and the solid sinks. Water does the opposite.",
    "Water is made of tiny bits called molecules that tug on each other. In liquid water they tumble about and crowd close together. When water freezes, they lock into a neat pattern of six-sided rings, like a honeycomb. Each ring has open space in the middle.",
    "Because of those gaps, water grows by about 9 percent when it freezes. That is why a full bottle of water can crack in the freezer. The same water now needs more room.",
    "A thing floats when it is lighter than the same amount of the liquid around it. A litre of water weighs about 1 kilogram. A litre of ice weighs only about 0.917 kilograms. So ice floats, with a small part of it poking above the surface.",
    "This matters for life. Water is heaviest at about 4 °C. In winter, a lake cools from the top. Once the top water is colder than 4 °C, it gets lighter and stays on top. There it freezes into a lid of ice. Under the lid, the water at the bottom stays near 4 °C. Fish can live through the winter down there.",
  ],
  facts: [
    { id: "grow", label: "How much water grows when it freezes", value: "+9%", source: "ice" },
    { id: "water", label: "Density of liquid water", value: "1.000 g/cm³", source: "usgs" },
    { id: "ice", label: "Density of ice", value: "0.917 g/cm³", source: "ice" },
    { id: "densest", label: "Water is densest at", value: "4 °C", source: "usgs" },
  ],
  sources: {
    ice: wiki("Ice", "Ice"),
    icelattice: wiki("Ice_Ih", "Ice Ih"),
    usgs: { title: "USGS Water Science School: Water density", url: "https://www.usgs.gov/special-topics/water-science-school/science/water-density" },
  },
  figure: {
    caption: "Frozen water locks into open six-sided rings, so ice is lighter than water and a lake freezes from the top, with 4 °C water below.",
    alt: "Two jars: one of crowded liquid water molecules, one of ice's open hexagonal rings; below, a lake with a red lid of ice on top, water at 4 °C at the bottom and a fish.",
  },
};

const TIDES: Article = {
  slug: "how-tides-work",
  kicker: "Earth",
  headline: "How tides work",
  deck: "The Moon pulls the oceans into two bulges, and the Earth turns through both of them every day.",
  published: PUBLISHED,
  body: [
    "Spend a day at the seaside and you will see the water creep up the beach and slide back again. These slow rises and falls are the tides. They are caused mostly by the Moon.",
    "The Moon's gravity pulls on the whole Earth. But it pulls hardest on the side nearest to it and least on the far side. The ocean facing the Moon is pulled toward it and heaps up into a bulge.",
    "On the far side, the ocean is pulled least of all. It gets left behind a little, so a second bulge forms there too. That is why there are two bulges, one on each side of the Earth.",
    "The Earth spins through both bulges. Each time your beach passes under one, you get a high tide. The Moon is also moving along its path, so a full turn back to the Moon takes about 24 hours and 50 minutes. Most coasts get two high tides in that time, and they come a little later each day.",
    "The Sun makes tides too, but it is so far away that its effect is smaller. The Moon's pull on the tides is about 2.2 times the Sun's. At new Moon and full Moon, the Sun, Moon and Earth line up and their pulls add together. The tides are bigger, and these are called spring tides. At half Moon, the two pull at right angles. The tides are smaller, and these are called neap tides.",
  ],
  facts: [
    { id: "cycle", label: "Two high tides come round every", value: "24 h 50 min", source: "noaa" },
    { id: "ratio", label: "The Moon's tidal pull against the Sun's", value: "2.2×", source: "tide" },
    { id: "spring", label: "Spring tides: Sun, Moon and Earth", value: "in line", source: "spring" },
    { id: "neap", label: "Neap tides: Sun and Moon", value: "at right angles", source: "noaa" },
  ],
  sources: {
    noaa: { title: "NOAA Ocean Service: Tides and Water Levels", url: "https://oceanservice.noaa.gov/education/tutorial_tides/" },
    spring: { title: "NOAA Ocean Service: What is a spring tide?", url: "https://oceanservice.noaa.gov/facts/springtide.html" },
    tide: wiki("Tide", "Tide"),
  },
  figure: {
    caption: "The Moon stretches the oceans into two bulges; when the Sun lines up with it the tides are biggest.",
    alt: "The Earth with two red bulges of ocean, one toward the Moon and one away from it; below, the Sun, Earth and Moon in a line for spring tides and at right angles for neap tides.",
  },
};

export const ARTICLES: readonly Article[] = [SKY, LEAP, GPS, GIGABYTE, ICE, TIDES];

export function bySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function neighbours(slug: string): { prev?: Article; next?: Article } {
  const i = ARTICLES.findIndex((a) => a.slug === slug);
  if (i < 0) return {};
  return { prev: ARTICLES[i - 1], next: ARTICLES[i + 1] };
}
