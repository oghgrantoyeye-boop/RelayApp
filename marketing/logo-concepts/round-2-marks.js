// Signal-fire directions on a 24x24 grid: hilltop fires lit one after another.
const GOLD = "#d9a45b";
const P = (n) => +n.toFixed(2);
// A flame centered at (x, y), scale s (unit flame is about 4.4 wide and 6.4 tall), tip leaning slightly right.
const flame = (x, y, s, fill = GOLD, op = 1) =>
  `<path transform="translate(${P(x)} ${P(y)}) scale(${s})" fill="${fill}" opacity="${op}" d="M.4-3.4C1.8-1.6 2.3-.4 2.3.9 2.3 2.5 1.2 3.4 0 3.4S-2.3 2.5-2.3 1C-2.3-.2-1.8-1-1.2-1.8-1-.9-.6-.4-.2-.3-.5-1.4-.2-2.5.4-3.4z"/>`;
const peak = (x0, ax, ay, x1, ink, base = 21) => `<path d="M${x0} ${base}L${ax} ${ay}L${x1} ${base}z" fill="${ink}" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round"/>`;
const onPeak = (ax, ay, s) => flame(ax, ay - 1.15 - 3.2 * s, s);
const ALL = [
  {
    id: "range", name: "A · The range",
    idea: "Three hilltops, each with its fire lit. The message has crossed every team.",
    svg: (ink) => peak(1, 6, 13.5, 11, ink) + peak(6, 12, 10, 18, ink) + peak(13, 18.5, 7, 23, ink) + onPeak(6, 13.5, 0.62) + onPeak(12, 10, 0.62) + onPeak(18.5, 7, 0.62),
  },
  {
    id: "relay", name: "B · Lit in turn",
    idea: "Same range, fires growing as the signal travels. Shows the relay, not just the fires.",
    svg: (ink) => peak(1, 6, 13.5, 11, ink) + peak(6, 12, 10, 18, ink) + peak(13, 18.5, 7, 23, ink) + onPeak(6, 13.5, 0.42) + onPeak(12, 10, 0.58) + onPeak(18.5, 7, 0.78),
  },
  {
    id: "answer", name: "C · The answering fires",
    idea: "One beacon lit, and two distant fires answering it. Simple and bold at small sizes.",
    svg: (ink) => peak(2.6, 12, 8.4, 21.4, ink) + onPeak(12, 8.4, 0.82) + flame(3.4, 13.6, 0.4) + flame(20.6, 13.6, 0.4),
  },
  {
    id: "towers", name: "D · Beacon towers",
    idea: "Geometric towers rising left to right, each topped with a fire. Reads like a signal growing.",
    svg: (ink) => [[3, 15], [10.2, 11.5], [17.4, 8]].map(([x, top]) => `<rect x="${x}" y="${top}" width="3.6" height="${21 - top}" rx="1.1" fill="${ink}"/>` + flame(x + 1.8, top - 1.1 - 3.2 * 0.6, 0.6)).join(""),
  },
  {
    id: "single", name: "E · One beacon",
    idea: "A single hilltop fire. The most iconic and the easiest to recognise at 16px, without the chain.",
    svg: (ink) => peak(3, 12, 10, 21, ink) + onPeak(12, 10, 1.05),
  },
];

module.exports = ALL.filter((m) => ["range", "relay", "single"].includes(m.id)).map((m, i) => ({ ...m, name: ["1", "2", "3"][i] + m.name.slice(1) }));
