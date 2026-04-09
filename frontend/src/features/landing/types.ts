export type FeatureCard = {
  title: string;
  description: string;
  tone: "light" | "purple";
  iconSrc: string;
};

export type EventCard = {
  title: string;
  date: string;
  imageSrc: string;
};

export type FaqItem = {
  title: string;
  body: string;
};
