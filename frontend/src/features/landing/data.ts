import type { EventCard, FaqItem, FeatureCard } from "./types";

export const featureCards: FeatureCard[] = [
  {
    title: "Explore events",
    description:
      "Discover hidden workshops, late-night hackathons, and networking mixers exclusively for student pass holders.",
    tone: "light",
    iconSrc: "/images/icons/compass.svg",
  },
  {
    title: "Submit entries",
    description:
      "Seamless project uploads for competitions and talent showcases.",
    tone: "light",
    iconSrc: "/images/icons/file-upload.svg",
  },
  {
    title: "Track activity",
    description:
      "Real-time stats on your leaderboard position and schedule updates.",
    tone: "light",
    iconSrc: "/images/icons/chart.svg",
  },
  {
    title: "Access perks",
    description:
      "Unlock student-only discounts, early access to limited workshops, and digital swag kits that never expire.",
    tone: "purple",
    iconSrc: "/images/icons/access-tick.svg",
  },
];

export const eventCards: EventCard[] = [
  {
    title: "Cyber Defense Cup",
    date: "March 14 • 10:00 AM",
    imageSrc: "/images/events/cybersecurity-hackathon.png",
  },
  {
    title: "AI & Future Tech",
    date: "March 14 • 02:00 PM",
    imageSrc: "/images/events/ai-symposium.png",
  },
  {
    title: "E-Sports Invitational",
    date: "March 15 • 11:00 AM",
    imageSrc: "/images/events/esports-arena.png",
  },
  {
    title: "Design Sprint 2.0",
    date: "March 16 • 09:00 AM",
    imageSrc: "/images/events/design-thinking.png",
  },
];

export const faqItems: FaqItem[] = [
  {
    title: "Why is access restricted?",
    body: "Our sponsors provide exclusive rewards and internship opportunities specifically for verified students. Restriction ensures these benefits reach the intended audience.",
  },
  {
    title: "What counts as student verification?",
    body: "We accept valid .edu email addresses or a high-quality photo of your current institutional ID card showing the academic year.",
  },
  {
    title: "Can I use my college ID?",
    body: "Yes! Simply upload a clear image of your physical ID card in the portal. Our team reviews all manual submissions within 12 hours.",
  },
];
