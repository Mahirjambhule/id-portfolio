/**
 * The projects shown under "Selected work".
 *
 * Names, words and stacks are placeholders: replace them with the real ones.
 * Add `href` to a project and its "View project" button becomes a link.
 *
 * The orbit is laid out for four. It takes three to six, and the room's light
 * and the small orbit under the cards follow this list.
 */

/** The room a project hangs in: where its light comes from and what colour it is. */
export type Light = "morning" | "side" | "soft" | "daylight";

/** The colour of the small dot beside a project's category. */
export type Accent = "slate" | "sage" | "clay" | "stone";

export interface Project {
  name: string;
  category: string;
  /** One line about it, set large under its name, and the words that end it, set in italic. */
  line: string;
  emphasis: string;
  /** What it is, in a sentence. */
  description: string;
  stack: readonly string[];
  accent: Accent;
  light: Light;
  /** Where "View project" leads. Leave out until the case study exists. */
  href?: string;
}

export const projects: readonly Project[] = [
  {
    name: "Haven Estates",
    category: "Real estate",
    line: "Plan, light and proportion first.",
    emphasis: "Price second.",
    description: "A property platform where every listing opens like an architect’s drawing set.",
    stack: ["Next.js", "TypeScript", "Mapbox", "Sanity"],
    accent: "slate",
    light: "morning",
  },
  {
    name: "Pulse",
    category: "Health",
    line: "A calmer way to follow",
    emphasis: "your health.",
    description: "Readings become slow, flowing forms instead of charts that ask for attention.",
    stack: ["React", "D3", "Node.js", "PostgreSQL"],
    accent: "sage",
    light: "side",
  },
  {
    name: "Utsav",
    category: "Festival",
    line: "A festival that opens out",
    emphasis: "ring by ring.",
    description: "Programme, artists and tickets unfold from one centre, the way a rangoli is drawn.",
    stack: ["Next.js", "GSAP", "Stripe", "Contentful"],
    accent: "clay",
    light: "soft",
  },
  {
    name: "Kiln",
    category: "Ceramics",
    line: "Every piece, turned slowly",
    emphasis: "under the light.",
    description: "A shop for a ceramics studio, where each piece is shown glaze and all, as it would sit in your hands.",
    stack: ["Next.js", "Three.js", "Shopify", "Motion"],
    accent: "stone",
    light: "daylight",
  },
];
