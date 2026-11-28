# How the demo organizations work today

Notes behind the five customer demos in `src/lib/demos/`. Each demo tells one story: one team's promise slips, and the people two teams away are the last to hear. This file records what we checked against real practice, what we changed, and where the sources are.

## Software company (Northwind Labs)

- **What's in the story.** A per-merchant rate limiter fails load testing, which blocks webhook retries, which blocks a launch. Teams work in Jira, GitHub and Slack.
- **Checked against practice.** Payment APIs retry failed webhooks with exponential backoff over hours to days, and they use idempotency keys to make duplicates safe ([Hookdeck on Stripe retries](https://hookdeck.com/webhooks/stripe/guide-duplicates-ordering-retries-timeouts), [Svix on retry strategies](https://www.svix.com/resources/webhook-university/reliability/webhook-retry-strategies/)). Northwind's own design (5 attempts over 24 hours) is a reasonable choice.
- **The demo's Worker teammate.** A coding agent that checks out the repository in a sandbox, fixes the limiter leak and opens a pull request for review.

## City hall (City of Harborview)

- **What's in the story.**
  - A water main must be finished, and its trench restored, before the street is repaved.
  - Damaged valves delay the main.
  - Residents get door-hanger notice before shutoffs.
- **Checked against practice.** US cities sequence their projects this way: water main first, then services, then restoration and paving. They notify residents ahead of shutoffs ([Ann Arbor's Crescents project](https://www.a2gov.org/departments/engineering/Pages/Crescents-Water-Main-and-Road-Improvements-Project.aspx), [Naperville water main replacements](https://www.naperville.il.us/watermain-replacements), [SFPUC Baker and Sutter project](https://www.sfpuc.gov/construction-contracts/construction-projects/baker-sutter-streets-water-main-replacement)).
- **Added.** A contractor change order, CO-14, with the language these contracts use: extra crew days, substantial completion and liquidated damages.
- **The demo's Worker teammate.** A change order reviewer that flags cost and schedule changes for the project manager.

## Architecture firm (Halden & Moss)

- **What's in the story.** A facade change during design development means the energy and daylight model has to be rebuilt before the package goes to the client.
- **Checked against practice.** Energy modeling runs alongside the design phases, and a change to the envelope (the outer shell) means rerunning the model ([LEEDuser on design-phase energy modeling](https://www.leeduser.buildinggreen.com/tipsheet/design-phase-energy-modeling-leed), [RMI on energy modeling in design](https://rmi.org/wp-content/uploads/2017/05/RMI_Document_Repository_Public-Reprts_2010-27_EnergyModelingDesignPhase.pdf)).
- **Changed.** The route question is now "When will the library energy model be ready?" so your agent asks Sustainability, which owns the model. Before, it went to the studio that owns the project.
- **The demo's Worker teammate.** An energy code researcher that checks model inputs against the project's targets.

## Fashion house (Maison Verel)

- **What's in the story.** A dye lot fails a color-fastness test, which delays coat samples, the buyer appointments and the lookbook shoot.
- **Fixed.** The season was wrong. Spring/Summer collections are sold to buyers in September and October, so December buyer appointments and a December lookbook belong to a **pre-collection**. The demo now uses **Pre-Fall '27** coats, and pre-orders ship in June ([FashionUnited on the fashion seasons](https://fashionunited.com/news/background/the-fashion-system-the-fashion-seasons-explained/2024012157967), [Heuritech on fashion seasons](https://heuritech.com/articles/fashion-seasons-the-complete-guide/), [Première Vision on pre-collections](https://www.premierevision.com/articles/db17e7b0-7afa-ef11-90cb-00224888722c/let-s-have-a-look-at-the-state-of-pre-collections-with-christelle-cagi-nicolau)).
- **Checked against practice.**
  - Rubbing fastness is tested under ISO 105-X12 and graded 1 to 5. Brands commonly ask for 4 dry ([ISO 105-X12](https://www.iso.org/standard/65207.html)).
  - GRS is a real certification for recycled content.
- **The demo's Worker teammate.** A materials researcher that reads mill test reports the day they land.

## Regional daily newspaper (The Lakeport Courier)

- **Why it exists.** It was built for a reporter at a mid-size Canadian daily. The paper is fictional, and nothing uses a real paper's name or branding.
- **What's in the story.** The care home operator's lawyer sends a letter disputing four points, so the pre-publication legal read misses Dec 5. That puts the final edit, the Saturday front page and the 6 am web, newsletter and push launch at risk.
- **Checked against practice.**
  - Canadian papers rely on the "responsible communication" defence from Grant v. Torstar (2009). It weighs whether the subject was given a fair chance to respond, which is why the story turns on right-of-reply letters and a legal read ([Columbia Global Freedom of Expression on Grant v. Torstar](https://globalfreedomofexpression.columbia.edu/cases/grant-v-torstar/), [Canadian Journalism Foundation](https://cjf-fjc.ca/scc-creates-new-libel-defence-responsible-communication/), [OCNA defamation session](https://www.ocna.org/uploads/files/2022%20OCNA%20Convention_%20Defamation%20%26%20Copyright.pdf)).
  - Big Saturday and Sunday A1 stories are planned days ahead at news meetings ([The Columbian on planning Sunday A1 stories](https://columbian.com/news/2019/jan/12/from-the-newsroom-planning-is-key-for-sunday-a1-stories)).
  - Publication bans are a routine check on the courts beat.
- **The demo's Worker teammate.** Legal read prep, which lists every named person, figure and disputed point for the lawyer. The lawyer still makes every legal call.

## Agents as teammates

These sources shaped the split between Q&A teammates and Workers, and the rule that Workers run in a sandbox and ask before acting outside the team. The audience asked for agents that research markets, review legal documents and change code, and that are either provided or custom. Workers stay scoped to one team's tools and permissions, and a person approves anything that leaves the team. That is the gap between enterprise search (find a document) and an agent teammate (do a job, safely).
