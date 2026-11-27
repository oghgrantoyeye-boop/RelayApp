# Beacon launch campaign

Five posts, ready to publish. Each image is 1080×1350 (4:5), which LinkedIn, Instagram and X all display well. Pair each image with the caption below and a tracked link.

**Tracked links:** the early-access page records `utm_source`, `utm_medium`, `utm_campaign` and `ref` with each request, so you can see which post brought someone in. Replace `YOUR-DOMAIN` with your site's domain, for example:

```
https://YOUR-DOMAIN/early-access?utm_source=linkedin&utm_campaign=launch&utm_content=post-1
```

**Before posting:** set `EARLY_ACCESS_WEBHOOK_URL` in Vercel (see the README), so requests reach you even though the demo database resets.

## Post 1: The problem

Image: `social/post-1-the-problem.png`

> Most organizations don't move slowly because people aren't working hard enough. They move slowly because coordination breaks down between teams.
>
> The roadmap is in one tool. The code is in another. Decisions are buried in Slack. Dependencies live in people's heads.
>
> Beacon connects the dots.
>
> A signal across every team.

## Post 2: The vision

Image: `social/post-2-the-vision.png`

> What if your organization had a shared operating picture?
>
> Every initiative. Every dependency. Every decision. Every commitment.
>
> One place to understand how the organization is working, and what needs to happen next.
>
> Meet Beacon.

## Post 3: Product

Image: `social/post-3-product.png`

> Stop asking five people for the status of one project.
>
> Beacon connects organizational context so you can understand what's happening, what's blocked and who needs to act.

## Post 4: AI agents

Image: `social/post-4-ai-agents.png`

> The future isn't one AI assistant for every employee. It's AI agents that can coordinate across the organization.
>
> But agents need context, ownership, permissions and a shared understanding of organizational priorities.
>
> That's the infrastructure Beacon is building.

## Post 5: The product and engineering wedge

Image: `social/post-5-product-engineering.png`

> Product knows what needs to be built. Engineering knows what can be built. Why are those two things still disconnected?
>
> Beacon connects requirements, decisions, technical constraints and delivery, so changes in one place don't become surprises somewhere else.

## Regenerating the images

The images are rendered from HTML with the site's fonts and colors. To change copy, edit the post text in this file's source script (ask Claude to regenerate them), or recreate them in your design tool using: background `#F7F6F2` or `#172333`, text `#17191D`, accent `#315EFB`, gold `#D9A45B`, Geist Semibold for headlines.
