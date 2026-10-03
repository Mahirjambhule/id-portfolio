/**
 * Everything personal lives here, so the copy can change without touching components.
 * `url`, `email` and the links under `contact` are placeholders: swap them for the
 * real ones before going live.
 *
 * Three files live in /public: angel-logo.png, angel-portrait.png and
 * angel-resume.pdf. Replace any of them, keeping its name, and the site picks up
 * the new one.
 */
export const site = {
  name: "Angel",
  role: "Creative Developer",
  description:
    "Angel is a creative developer designing and building tactile, motion-led websites for studios and brands that care how things feel.",

  /** Encoded into the QR code on the badge. */
  url: "https://example.com",
  email: "hello@angel.dev",

  availability: {
    open: true,
    label: "Available for projects",
  },

  badge: {
    serial: "0001",
    edition: "MMXXVI",
  },

  /** Read out one by one as the badge is scanned in the identity section. */
  identity: {
    location: "Pune, India",
    experience: "Frontend Engineer",
    speciality: ["Motion Design", "Interactive Experiences"],
    currently: "Building premium digital products",
    statement: "Crafting meaningful digital experiences through thoughtful design, motion, and engineering.",
  },

  /** Printed on the back of the badge, which the closing section turns over. */
  contact: {
    github: { label: "github.com/angel", href: "https://github.com/angel" },
    linkedin: { label: "linkedin.com/in/angel", href: "https://www.linkedin.com/in/angel" },
    resume: { label: "Download PDF", href: "/angel-resume.pdf", file: "Angel-Resume.pdf" },
  },

  /** The last words on the page, under the badge. */
  closing: {
    heading: ["Let’s Build Something", "Beautiful."],
    invitation: "I’m always open to meaningful collaborations, ambitious ideas, and creative partnerships.",
    signOff: "Let’s create something people remember.",
  },
} as const;
