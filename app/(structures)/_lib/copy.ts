// The eight pages' words as data, in series order. Plain text only (no HTML,
// no markdown, no Big-O, no code), so the tests can read it: each page is 180
// to 350 words at a reading grade of 8 or under, in short sentences, with the
// everyday picture first and the technical word after it. Every step count
// in "How a move works" is one the machine really takes, and every source is
// https on the allowlist.

export type Source = { label: string; url: string };
export type Parts = {
  what: readonly string[]; // What it is
  how: readonly string[]; // How a move works
  where: readonly string[]; // Where you meet it
  trap: readonly string[]; // Watch out for
};
export type Page = {
  slug: string; // the structure's slug
  title: string; // ≤ 4 words
  deck: string; // one sentence, ≤ 30 words
  caption: string; // the In life drawing's rule, one sentence
  parts: Parts;
  sources: readonly Source[]; // ≥ 2
};

export const PART_TITLES: Record<keyof Parts, string> = {
  what: "What it is",
  how: "How a move works",
  where: "Where you meet it",
  trap: "Watch out for",
};

// https only, on exactly these hosts: places a reader can check us.
export const SOURCE_HOSTS = ["en.wikipedia.org", "developer.mozilla.org", "docs.python.org", "en.cppreference.com"] as const;

export function allowedSource(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === "https:" && (SOURCE_HOSTS as readonly string[]).includes(u.hostname);
}

const wiki = (page: string, title: string): Source => ({ label: `Wikipedia: ${title}`, url: `https://en.wikipedia.org/wiki/${page}` });
const mdn = (path: string, title: string): Source => ({
  label: `MDN: ${title}`,
  url: `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/${path}`,
});
const python = (path: string, title: string): Source => ({ label: `Python docs: ${title}`, url: `https://docs.python.org/3/library/${path}` });

const ARRAY: Page = {
  slug: "array",
  title: "The array",
  deck: "A row of numbered drawers: you can open any one at once, but a new thing near the front makes the rest move up.",
  caption: "Every drawer has a number, so you can open any one at once.",
  parts: {
    what: [
      "Think of a chest of eight drawers with a number on each. The first drawer is number 0, the next is 1, and so on up to 7. Each drawer holds one thing.",
      "In a computer, this is called an array. The things sit side by side in memory, in order, with no gaps. The number on a drawer is called its index.",
    ],
    how: [
      "To read drawer 3, you go straight to it. You do not open drawers 0, 1 and 2 first. It takes 1 step, however many drawers there are.",
      "Finding a number is slower. If you do not know where 16 is, you open the drawers one by one from the front. In 4, 7, 8, 15, 16, 23, you meet 16 in the fifth drawer, so it takes 5 steps.",
      "Putting a new thing in the middle is the slowest. Say the drawers hold 4, 8, 15, 16 and 23, and 7 must go in drawer 1. First 23 moves up one drawer, then 16, then 15, then 8. Then 7 is written in. That is 5 steps.",
    ],
    where: [
      "Arrays are everywhere. A list of high scores, the dots of colour in a photo and the days of a month are all kept in arrays. Most of the other things in this series are built on top of one.",
    ],
    trap: [
      "One thing in at the front moves everything behind it. With eight things inside, that is 9 steps: eight moves and a write. Taking the front one out is just as bad. If you add and take at the front a lot, the next page may suit you better.",
    ],
  },
  sources: [wiki("Array_(data_structure)", "Array (data structure)"), mdn("Array", "Array")],
};

const LINKED_LIST: Page = {
  slug: "linked-list",
  title: "The linked list",
  deck: "A chain of notes, each saying where the next one is, so adding at the front is quick but reaching the end means walking.",
  caption: "To reach the fifth note you read the four before it.",
  parts: {
    what: [
      "Picture a treasure hunt. Each note tells you where to find the next one. You cannot skip ahead, because only the note before it knows where the next one is hidden.",
      "A list kept this way is called a linked list. Each note is called a node. It holds a value and an arrow to the next node, called a link. The last arrow points nowhere.",
    ],
    how: [
      "Adding at the front is quick. Write a new note, point its arrow at the old first note, and start the list there. That is 2 steps, however long the list is.",
      "Finding a value means walking. In the list 4, 9, 3, 7, finding 9 takes 2 steps: read 4, then read 9.",
      "Taking 3 out takes 4 steps. You read 4, 9 and 3 to find it. Then you move the arrow of 9 so it skips 3 and points straight at 7. Nothing else has to move. The list is now 4, 9, 7.",
    ],
    where: [
      "A music player's list of songs, the undo trail in some apps and the pages behind a back button can all be linked lists. They shine when things are added and taken out often, since nothing has to shift along.",
    ],
    trap: [
      "There is no drawer number. To reach the end, you must walk past every note. With eight notes, taking out the last one takes 9 steps: eight reads and one new arrow. So keep the things you need most near the front.",
    ],
  },
  sources: [wiki("Linked_list", "Linked list"), python("collections.html#collections.deque", "collections.deque")],
};

const STACK: Page = {
  slug: "stack",
  title: "The stack",
  deck: "A pile of plates where you only ever touch the top one, so every move takes a single step.",
  caption: "The last plate on is the first plate off.",
  parts: {
    what: [
      "Think of a pile of clean plates by the sink. You put a new plate on the top. When you need a plate, you take the one on the top. You never pull one from the middle.",
      "This is called a stack. Putting a thing on top is called a push. Taking the top thing off is called a pop. Looking at the top without taking it is called a peek.",
    ],
    how: [
      "Push 1, then 7, then 4, and 4 is on top. A peek shows 4 in 1 step. A pop takes 4 off in 1 step, and 7 is on top again. Push 2, and the pile reads 1, 7, 2 from the bottom up.",
      "Every move touches only the top plate. It does not matter if the pile holds three plates or three thousand. Each move is still 1 step.",
    ],
    where: [
      "When you press undo, the app pops the last thing you did off a stack. A web browser keeps the pages you came from on a stack for its back button. A computer also keeps a stack of jobs. When it starts a small job in the middle of a big one, it pushes the big one, and pops it back when the small job is done.",
    ],
    trap: [
      "A pile only has room for so many plates. This one holds 7. Push one more onto a full pile and it overflows, so the machine says no. A pop on an empty pile is a mistake too, because there is nothing to take.",
    ],
  },
  sources: [wiki("Stack_(abstract_data_type)", "Stack (abstract data type)"), mdn("Array/push", "Array.prototype.push")],
};

const QUEUE: Page = {
  slug: "queue",
  title: "The queue",
  deck: "A line at a counter where people join at the back and leave from the front, each in two quick steps.",
  caption: "First in line is first served.",
  parts: {
    what: [
      "Think of a line at a bakery. New people join at the back. The person at the front is served and leaves. Nobody cuts in.",
      "This is called a queue. Joining the back is often called enqueue, and leaving the front is called dequeue. The first thing in is the first thing out.",
    ],
    how: [
      "Under this line is a ring of 8 tiles, numbered 0 to 7. A head hand points at the front of the line. A tail hand points at the first free tile, just behind the back.",
      "To join, write the number on the tile under the tail hand, then move the hand on one tile. That is 2 steps. To leave, take the number under the head hand, then move that hand on. That is 2 steps too.",
      "Join 5, 2 and 9, and let 5 leave. Then 6, 1, 8, 3 and 7 join. When 7 lands on tile 7, the tail hand wraps round to tile 0. The line reads 2, 9, 6, 1, 8, 3, 7.",
    ],
    where: [
      "Printers keep their jobs in a queue. So do the songs on a playlist and the messages waiting to be sent. A computer keeps the keys you press in a queue, so the letters come out in the order you typed them.",
    ],
    trap: [
      "If you kept the line in a plain row of tiles, it would walk off the end. People leave the front and join the back, so the line creeps along. The ring lets it wrap round and use the free tiles at the start again.",
    ],
  },
  sources: [wiki("Queue_(abstract_data_type)", "Queue (abstract data type)"), wiki("Circular_buffer", "Circular buffer")],
};

const HASH_TABLE: Page = {
  slug: "hash-table",
  title: "The hash table",
  deck: "A coat check that works out each coat's hook from the coat itself, so you can go straight to it.",
  caption: "Work out the hook from the coat, and go straight there.",
  parts: {
    what: [
      "Picture a coat check with 8 hooks. Instead of a ticket, the clerk works out a hook number from your coat. When you come back, the clerk works it out again and goes straight to the right hook.",
      "This is called a hash table. The rule that turns a thing into a number is called a hash. Each hook is called a bucket.",
    ],
    how: [
      "Here the things are short words. Give each letter its place in the alphabet, so a is 1 and z is 26. Add them up and share the total by 8. What is left over is the bucket.",
      "For cat, 3 and 1 and 20 make 24. Share 24 by 8 and nothing is left, so cat goes in bucket 0. Dog makes 26, which leaves 2, so dog goes in bucket 2.",
      "Now put act. Its letters add up to 24 as well, so it lands in bucket 0, just behind cat. To get act back, work out the bucket, look at cat, then look at act. That is 3 steps.",
    ],
    where: [
      "Hash tables are behind the names in your phone, the words in a spell checker and the logins on a website. Most coding languages have one built in, called a dictionary or a map.",
    ],
    trap: [
      "Words made of the same letters, like cat and act, land in the same bucket here. That is because adding up ignores the order of the letters. When lots of words share a bucket, a find has to look through them all. A real hash mixes the order in, so the words spread out.",
    ],
  },
  sources: [wiki("Hash_table", "Hash table"), mdn("Map", "Map")],
};

const SEARCH_TREE: Page = {
  slug: "binary-search-tree",
  title: "The search tree",
  deck: "A guessing game made into a shape: at each number you go left for smaller and right for bigger.",
  caption: "Each guess throws away half of what is left.",
  parts: {
    what: [
      "Think of the game where a friend picks a number and you guess. After each guess they say higher or lower. A good guess throws away half of what is left.",
      "A search tree keeps numbers so that every find plays that game. Each number sits in a node with room for two children. Smaller numbers go on the left and bigger ones on the right. The top node is called the root.",
    ],
    how: [
      "Put in 8, 3, 10, 1, 6 and 14, in that order. To find 6, start at 8. 6 is less than 8, so go left to 3. 6 is more than 3, so go right, and there is 6. That is 3 steps.",
      "To find 7, take the same path. At 6, 7 is more, so go right, but there is nothing there. So 7 is not in the tree, and you know it after 3 steps.",
      "Putting a number in works the same way. Walk down as if you were looking for it, and write it in the empty place where the walk ends.",
    ],
    where: [
      "Search trees keep things in order while they change: the names in a phone book app, the dates in a calendar, the words in a dictionary. Many big stores of data use a cousin of this tree to find things fast.",
    ],
    trap: [
      "Put in 1, 2, 3, 4 and 5 in order, and each number goes to the right of the last. The tree grows into a line, 5 levels tall. A find for 5 then costs 5 steps, as slow as walking a list. Real search trees fix this by turning bits of themselves to stay bushy.",
    ],
  },
  sources: [wiki("Binary_search_tree", "Binary search tree"), wiki("Binary_search", "Binary search")],
};

const HEAP: Page = {
  slug: "heap",
  title: "The heap",
  deck: "A ladder of matches where the smaller number always wins, so the smallest of all waits at the top.",
  caption: "The winner is always at the top.",
  parts: {
    what: [
      "Picture a ladder of matches in a game. In each match the smaller number wins and moves up. Whoever is at the top has beaten everyone, so the smallest number is always there.",
      "This is called a heap. Each node is no bigger than its children. Nothing else about the order is fixed, which is what makes a heap quick to keep.",
    ],
    how: [
      "The ladder is really a row of boxes. The children of box 0 are boxes 1 and 2. The children of box 1 are boxes 3 and 4.",
      "Add 5, 3, 8, 1 and 4. Each new number goes in the first free box. Then it swaps with the box above it for as long as it is smaller. When 1 lands in box 3, it beats 5 and then 3, and climbs to the top. The row reads 1, 3, 8, 5, 4.",
      "To take the smallest, take 1 off the top. Move the last box, 4, up to the top. 4 is bigger than its smaller child, 3, so they swap. The row reads 3, 4, 8, 5. That is 3 steps.",
    ],
    where: [
      "Heaps choose what comes next. A list at a hospital that sees the most urgent case first can be a heap. So can a game that runs the next timer, or a map app that tries the nearest road first.",
    ],
    trap: [
      "The row is the tree. The children of box i are boxes 2i+1 and 2i+2, so no arrows are kept. But only the top is easy to find. Looking for any other number means checking the whole row.",
    ],
  },
  sources: [wiki("Binary_heap", "Binary heap"), python("heapq.html", "heapq")],
};

const GRAPH: Page = {
  slug: "graph",
  title: "The graph",
  deck: "A map of stations and lines, where a ripple from one station finds the shortest way to all the others.",
  caption: "Two routes can reach the same station.",
  parts: {
    what: [
      "Picture a metro map. Stations are joined by lines, and a station can have many lines. There is no top and no bottom, and there may be more than one way between two stations.",
      "This is called a graph. The stations are called nodes and the lines are called edges.",
    ],
    how: [
      "Here eight stations, A to H, are joined by nine lines. To ripple out from A, light A first. Then light each station one line away: B, C and D. Then each station one line from those: E, F and G. Then H.",
      "Each station is lit once, so the ripple from A takes 8 steps. It also finds the shortest way to each station. To get from A to H, follow the ripple back: H was reached from F, F from C, and C from A. The way is A, C, F, H, which is 3 hops.",
      "Drawing a new line takes 1 step, and so does rubbing one out.",
    ],
    where: [
      "Maps, flights, friends on a social app and links between web pages are all graphs. A sat nav ripples out over the roads to find your way home.",
    ],
    trap: [
      "A map is not a tree. Two routes can reach the same station, and a loop can lead you back to where you started. So a ripple must keep track of where it has been, or it goes round in circles for ever.",
    ],
  },
  sources: [wiki("Graph_(abstract_data_type)", "Graph (abstract data type)"), wiki("Breadth-first_search", "Breadth-first search")],
};

export const PAGES: readonly Page[] = [ARRAY, LINKED_LIST, STACK, QUEUE, HASH_TABLE, SEARCH_TREE, HEAP, GRAPH];

export const pageFor = (slug: string) => PAGES.find((p) => p.slug === slug);

/** All four parts, in order, as one run of paragraphs. */
export const body = (p: Page) => [...p.parts.what, ...p.parts.how, ...p.parts.where, ...p.parts.trap];

export function neighbours(slug: string): { prev?: Page; next?: Page } {
  const i = PAGES.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  return { prev: PAGES[i - 1], next: PAGES[i + 1] };
}
