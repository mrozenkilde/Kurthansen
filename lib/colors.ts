/** Standardpalette til vægfarver. Egne farver kan vælges med hex-vælgeren. */
export interface PaintColor {
  name: string;
  hex: string;
}

export const PAINT_COLORS: PaintColor[] = [
  { name: "Klassisk hvid", hex: "#F4F4EF" },
  { name: "Råhvid", hex: "#EFEAE0" },
  { name: "Sand", hex: "#D9CBB2" },
  { name: "Beige", hex: "#C9B698" },
  { name: "Lys grå", hex: "#C7C8C4" },
  { name: "Betongrå", hex: "#9A9C98" },
  { name: "Antracit", hex: "#3C4043" },
  { name: "Sort", hex: "#1E1E1E" },
  { name: "Støvet rosa", hex: "#D8AFA6" },
  { name: "Terracotta", hex: "#C06A4B" },
  { name: "Rød", hex: "#9E3B32" },
  { name: "Okker", hex: "#C99548" },
  { name: "Gul", hex: "#E4C65C" },
  { name: "Lysegrøn", hex: "#AEBFA2" },
  { name: "Flaskegrøn", hex: "#3E5C4A" },
  { name: "Lyseblå", hex: "#A9C2CF" },
  { name: "Støvet blå", hex: "#6E8CA0" },
  { name: "Mørkeblå", hex: "#2E4460" },
];
