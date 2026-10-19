import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITS, MAX_ADDED_SONGS, SWATCH_KEYS, parseSong, parseVideoId } from "./songs.ts";

const ID = "dQw4w9WgXcQ";
const valid = { video: ID, title: "Song", artist: "Band", note: "", colour: "mint" };

test("parseVideoId accepts a bare id and every link shape", () => {
  const accepted = [
    ID,
    `  ${ID}  `,
    `https://www.youtube.com/watch?v=${ID}`,
    `http://youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`,
    `https://www.youtube.com/watch?list=PLx&v=${ID}&t=42s`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abcDEF123`,
    `youtu.be/${ID}?t=10`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://youtube-nocookie.com/watch?v=${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://WWW.YouTube.com/watch?v=${ID}`,
  ];
  for (const input of accepted) assert.equal(parseVideoId(input), ID, input);
});

test("parseVideoId keeps - and _ in ids", () => {
  assert.equal(parseVideoId("a-_Z09bcdEF"), "a-_Z09bcdEF");
  assert.equal(parseVideoId("https://youtu.be/-_-_-_-_-_-"), "-_-_-_-_-_-");
});

test("parseVideoId refuses other hosts, schemes and wrong lengths", () => {
  const refused = [
    "",
    "   ",
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://evil.com/watch?v=${ID}`,
    `https://evil.com/youtube.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtube.com@evil.com/watch?v=${ID}`,
    `https://evil.com@youtube.com/watch?v=${ID}`,
    `https://youtu.be.evil.com/${ID}`,
    `javascript:alert(1)//youtube.com/watch?v=${ID}`,
    `javascript:${ID}`,
    `data:text/html,${ID}`,
    `ftp://youtube.com/watch?v=${ID}`,
    "dQw4w9WgXc", // 10
    "dQw4w9WgXcQQ", // 12
    "dQw4w9WgX!Q",
    `https://www.youtube.com/watch?v=dQw4w9WgXc`,
    `https://www.youtube.com/watch?v=dQw4w9WgXcQQ`,
    `https://youtu.be/dQw4w9WgXc`,
    `https://www.youtube.com/watch`,
    `https://www.youtube.com/`,
    `https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG`,
    `https://www.youtube.com/shorts/${ID}/extra`,
    `https://www.youtube.com/user/${ID}`,
  ];
  for (const input of refused) assert.equal(parseVideoId(input), null, input);
  assert.equal(parseVideoId(undefined as unknown as string), null);
  assert.equal(parseVideoId(42 as unknown as string), null);
});

test("parseSong trims a valid input", () => {
  const res = parseSong({
    video: ` https://youtu.be/${ID}?si=x `,
    title: "  Song  ",
    artist: " Band ",
    note: "  nice  ",
    colour: " coral ",
  });
  assert.deepEqual(res, {
    ok: true,
    song: { video: ID, title: "Song", artist: "Band", note: "nice", colour: "coral" },
  });
});

test("parseSong treats the note as optional", () => {
  const noNote: Record<string, unknown> = { ...valid };
  delete noNote.note;
  for (const fields of [valid, noNote, { ...valid, note: "   " }]) {
    const res = parseSong(fields);
    assert.ok(res.ok);
    assert.equal(res.song.note, "");
  }
});

test("parseSong enforces lengths", () => {
  assert.ok(parseSong({ ...valid, title: "x".repeat(LIMITS.title) }).ok);
  assert.ok(parseSong({ ...valid, note: "x".repeat(LIMITS.note) }).ok);
  const res = parseSong({
    ...valid,
    title: "x".repeat(81),
    artist: "y".repeat(81),
    note: "z".repeat(201),
  });
  assert.ok(!res.ok);
  assert.deepEqual(Object.keys(res.errors).sort(), ["artist", "note", "title"]);
});

test("parseSong refuses empty text and a bad video", () => {
  for (const video of ["", "dQw4w9WgXc", "dQw4w9WgXcQQ", "https://evil.com/watch?v=" + ID]) {
    const res = parseSong({ ...valid, video });
    assert.ok(!res.ok, video);
    assert.equal(res.errors.video, "Paste a YouTube link or video id.");
  }
  const res = parseSong({ ...valid, title: "  ", artist: "" });
  assert.ok(!res.ok);
  assert.deepEqual(Object.keys(res.errors).sort(), ["artist", "title"]);
});

test("parseSong only takes the known colours", () => {
  for (const colour of SWATCH_KEYS) assert.ok(parseSong({ ...valid, colour }).ok, colour);
  for (const colour of ["", "purple", "__proto__", "constructor", "toString", "hasOwnProperty", "Mint"]) {
    const res = parseSong({ ...valid, colour });
    assert.ok(!res.ok, colour);
    assert.deepEqual(Object.keys(res.errors), ["colour"]);
  }
});

test("parseSong reports every field at once and refuses non-strings", () => {
  const empty = parseSong({});
  assert.ok(!empty.ok);
  assert.deepEqual(Object.keys(empty.errors).sort(), ["artist", "colour", "title", "video"]);

  const file = new File(["x"], "x.txt"); // FormData gives a File for an uploaded field
  for (const key of ["video", "title", "artist", "note", "colour"]) {
    const res = parseSong({ ...valid, [key]: file });
    assert.ok(!res.ok, key);
    assert.ok(key in res.errors, key);
  }
  for (const bad of [42, null, ["a"], { a: 1 }]) {
    assert.ok(!parseSong({ ...valid, title: bad }).ok);
  }
});

test("parseSong ignores inherited and extra fields", () => {
  const res = parseSong(Object.create({ ...valid }));
  assert.ok(!res.ok);
  const extra = parseSong({ ...valid, role: "owner", createdBy: "x" });
  assert.ok(extra.ok);
  assert.deepEqual(Object.keys(extra.song).sort(), ["artist", "colour", "note", "title", "video"]);
});

test("the cap is twelve", () => {
  assert.equal(MAX_ADDED_SONGS, 12);
});
