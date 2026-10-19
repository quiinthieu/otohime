// No-Face: a soft dark shroud with a wavy hem and a white mask with pink marks.
import type { Drawing } from "./types.ts";

export const noFace: Drawing = {
  shapes: [
    { d: "M 31 82 C 22 86 17 94 21 99 C 26 98 31 93 34 89 Z", fill: "main" },
    { d: "M 89 82 C 98 86 103 94 99 99 C 94 98 89 93 86 89 Z", fill: "main" },
    { d: "M 60 17 C 82 17 92 36 92 60 C 92 84 95 106 104 126 Q 96 131 88 126 Q 80 132 72 127 Q 64 132 56 127 Q 48 132 40 127 Q 32 131 24 126 C 33 106 28 84 28 60 C 28 36 38 17 60 17 Z", fill: "main" },
    { d: "M 80 30 C 88 40 90 52 90 64 C 90 86 92 104 99 122 Q 95 124 92 123 C 86 104 84 84 84 62 C 84 50 83 40 80 30 Z", fill: "shade", stroke: false },
    { d: "M 41 52 C 41 38.2 49.5 27 60 27 C 70.5 27 79 38.2 79 52 C 79 65.8 70.5 77 60 77 C 49.5 77 41 65.8 41 52 Z", fill: "white" },
    { d: "M 46 44 Q 52 36 58 44 Q 52 41 46 44 Z", fill: "blush", stroke: false },
    { d: "M 74 44 Q 68 36 62 44 Q 68 41 74 44 Z", fill: "blush", stroke: false },
    { d: "M 49 56 Q 52 59 52 66 Q 52 59 55 56 Q 52 58 49 56 Z", fill: "blush", stroke: false },
    { d: "M 71 56 Q 68 59 68 66 Q 68 59 65 56 Q 68 58 71 56 Z", fill: "blush", stroke: false },
    { d: "M 48 50 Q 52 47 56 50", fill: "none" },
    { d: "M 64 50 Q 68 47 72 50", fill: "none" },
    { d: "M 56 71 Q 60 72 64 71", fill: "none" },
  ],
};
