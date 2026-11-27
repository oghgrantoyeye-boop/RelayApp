// Five logo directions on a 24x24 grid. ink = main color, bg = background (for knockouts), uid = unique id.
const BLUE = "#315efb", GOLD = "#d9a45b";
const P = (n) => n.toFixed(2);
function arc(cx, cy, r, a0, a1) {
  const rad = (a) => (a * Math.PI) / 180;
  return `M${P(cx + r * Math.cos(rad(a0)))} ${P(cy + r * Math.sin(rad(a0)))} A${r} ${r} 0 0 1 ${P(cx + r * Math.cos(rad(a1)))} ${P(cy + r * Math.sin(rad(a1)))}`;
}
module.exports = [
  {
    id: "lighthouse", name: "1 · Lighthouse, simplified",
    idea: "The current mark, cleaned up: a light, its beam, a tower. Literal and familiar.",
    svg: (ink) => `<path d="M12 8.2 1.6 3.4v5.2zM12 8.2l10.4-4.8v5.2z" fill="${GOLD}" opacity=".85"/><circle cx="12" cy="8.2" r="3.4" fill="${BLUE}"/><path d="M9.8 13h4.4l1.8 9H8z" fill="${ink}"/>`,
  },
  {
    id: "across", name: "2 · Across",
    idea: "One signal passing through every team. The tagline, drawn: a signal across every team.",
    svg: (ink, bg) => `${[7, 12.6, 18.2].map((x) => `<rect x="${x}" y="4" width="3.4" height="16" rx="1.7" fill="${ink}"/>`).join("")}<rect x="2.8" y="8.7" width="20.4" height="2.8" rx="1.4" fill="${GOLD}" stroke="${bg}" stroke-width="1.4" paint-order="stroke"/><circle cx="3.2" cy="10.1" r="2.7" fill="${BLUE}" stroke="${bg}" stroke-width="1.4" paint-order="stroke"/>`,
  },
  {
    id: "sidebyside", name: "3 · Side by side",
    idea: "A person (circle) and an agent (square), overlapping. The gold overlap is the shared work.",
    svg: (ink, bg, uid) => `<defs><clipPath id="c${uid}"><circle cx="7.8" cy="12" r="6.6"/></clipPath></defs><circle cx="7.8" cy="12" r="6.6" fill="${ink}"/><rect x="9.6" y="5.4" width="13.2" height="13.2" rx="3.6" fill="${BLUE}"/><rect x="9.6" y="5.4" width="13.2" height="13.2" rx="3.6" fill="${GOLD}" clip-path="url(#c${uid})"/>`,
  },
  {
    id: "blit", name: "4 · The lit b",
    idea: "A b with a light inside it. A monogram that holds up as an app icon.",
    svg: (ink) => `<rect x="4.4" y="2" width="3.8" height="20" rx="1.9" fill="${ink}"/><circle cx="13.9" cy="14.5" r="5.6" fill="none" stroke="${ink}" stroke-width="3.8"/><circle cx="13.9" cy="14.5" r="2.1" fill="${BLUE}"/><path d="${arc(13.9, 14.5, 10.2, -78, -28)}" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  {
    id: "pulse", name: "5 · Pulse",
    idea: "A signal going out: a light and two waves. Simple, but closer to familiar 'broadcast' icons.",
    svg: (ink) => `<circle cx="6.6" cy="12" r="3.6" fill="${BLUE}"/><path d="${arc(6.6, 12, 8.2, -48, 48)}" fill="none" stroke="${GOLD}" stroke-width="2.8" stroke-linecap="round"/><path d="${arc(6.6, 12, 13.8, -42, 42)}" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`,
  },
];
