// "Built by people previously at …": a slim band under the hero that slides sideways. Each company
// needs its logo at public/logos/<id>.svg. With reduced motion, it shows once and stands still.
import { NAMES } from "./Logos";

const COMPANIES = ["toast"];
const REPEAT = 6; // copies per group, so one group is wider than any screen

function Item({ dup }: { dup?: boolean }) {
  return (
    <span className={`marquee-item${dup ? " dup" : ""}`} aria-hidden={dup || undefined}>
      Built by people previously at
      {COMPANIES.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={id} src={`/logos/${id}.svg`} alt={dup ? "" : NAMES[id] ?? id} height={22} />
      ))}
    </span>
  );
}

export function BuiltByBand() {
  const group = (hidden: boolean) => (
    <div className="marquee-group" aria-hidden={hidden || undefined}>
      {Array.from({ length: REPEAT }, (_, i) => <Item key={i} dup={hidden || i > 0} />)}
    </div>
  );
  return (
    <section className="builtby" id="built-by" aria-label="Who builds Beacon">
      <div className="marquee">
        {group(false)}
        {group(true)}
      </div>
    </section>
  );
}
