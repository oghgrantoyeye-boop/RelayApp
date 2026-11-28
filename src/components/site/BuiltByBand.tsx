// "Built by people previously at …": a slim band under the hero. The label sits above a logos-only
// marquee (a still row while there are only a few). Each company needs its logo at public/logos/<id>.svg. With reduced motion, logos show
// once and stand still.
import { NAMES } from "./Logos";

const COMPANIES = ["toast"];
const REPEAT = 8; // copies per group, so one group is wider than any screen
const MARQUEE_MIN = 5; // fewer companies than this are shown once, without scrolling

function Logo({ id, dup }: { id: string; dup?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`marquee-item${dup ? " dup" : ""}`}
      src={`/logos/${id}.svg`}
      alt={dup ? "" : NAMES[id] ?? id}
      height={22}
      aria-hidden={dup || undefined}
    />
  );
}

export function BuiltByBand() {
  // With only a few companies a scrolling strip just shows the same logo over and over, so list them once, standing still.
  if (COMPANIES.length < MARQUEE_MIN) {
    return (
      <section className="builtby" id="built-by" aria-label="Who builds Beacon">
        <p className="builtby-label">Built by people previously at</p>
        <div className="builtby-static">
          {COMPANIES.map((id) => <Logo key={id} id={id} />)}
        </div>
      </section>
    );
  }

  const logos = (hidden: boolean) =>
    Array.from({ length: REPEAT }, (_, i) =>
      COMPANIES.map((id) => <Logo key={`${id}-${i}`} id={id} dup={hidden || i > 0} />),
    );

  return (
    <section className="builtby" id="built-by" aria-label="Who builds Beacon">
      <p className="builtby-label">Built by people previously at</p>
      <div className="builtby-track">
        <div className="marquee">
          <div className="marquee-group">{logos(false)}</div>
          <div className="marquee-group" aria-hidden="true">
            {logos(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
