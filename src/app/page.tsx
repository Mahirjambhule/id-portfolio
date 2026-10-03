import { Contact } from "@/components/contact/contact";
import { BadgeCard } from "@/components/hero/badge-card";
import { Hero } from "@/components/hero/hero";
import { Identity } from "@/components/identity/identity";
import { Logo } from "@/components/logo";
import { Process } from "@/components/process/process";
import { Work } from "@/components/work/work";

export default function Home() {
  return (
    <main>
      {/* The badge and the wordmark are rendered on the server and handed to the interactive hero. */}
      <Hero badge={<BadgeCard />} logo={<Logo maxWidth={124} maxHeight={26} alt="" eager />} />
      {/* The hero's badge, carried to a scanner and read. It has to follow the hero directly. */}
      <Identity />
      <Work />
      {/* How I work: four cards of words on the gallery wall. It slides in under the tail of the work. */}
      <Process />
      {/* The closing chapter: the same badge comes back down and is turned over. It has to come last. */}
      <Contact />
    </main>
  );
}
