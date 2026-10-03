/**
 * "How I work": the four steps every project goes through, each set as a card
 * of words on the gallery wall (src/components/process/). Change the words
 * freely.
 */

export interface Step {
  /** Where it comes in the work, in a word, in place of a number. */
  when: string;
  /** Its name, and the words that finish it, set in italic on a line of their own. */
  name: string;
  emphasis: string;
  text: string;
  /** What comes of it, in a few words. */
  yields: readonly string[];
}

export const process = {
  eyebrow: "Process",
  /** The title, and the word of it set in italic. */
  title: "How I",
  emphasis: "work",
  steps: [
    {
      when: "First",
      name: "Listen",
      emphasis: "closely",
      text: "Every project begins as a conversation: what it is for, who it is for, and how it should feel.",
      yields: ["Brief", "Audience", "Tone"],
    },
    {
      when: "Then",
      name: "Sketch",
      emphasis: "by hand",
      text: "Ideas go down on paper first, as rough layouts, type and motion studies, long before any code.",
      yields: ["Layout", "Type", "Storyboard"],
    },
    {
      when: "Next",
      name: "Build",
      emphasis: "to last",
      text: "Fast, accessible and sturdy, with motion that serves the words instead of competing with them.",
      yields: ["Front end", "Motion", "CMS"],
    },
    {
      when: "Finally",
      name: "Refine",
      emphasis: "every detail",
      text: "The last stretch is timing, easing and finish, adjusted until the whole thing feels effortless.",
      yields: ["Timing", "Easing", "Finish"],
    },
  ] satisfies readonly Step[],
};
