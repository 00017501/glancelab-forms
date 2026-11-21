# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Chosen by the owner: FastAPI + SQLite backend; admin in React, Tailwind, shadcn/ui and dnd-kit; participant runtime in jsPsych; docker-compose with Caddy on one EC2 instance.

## Users

- **The researcher (admin).** One non-technical member of a university neuromarketing student group. She builds study forms, uploads ad images, previews, publishes a link and downloads results. She will create many forms to experiment with, in long sessions on a laptop. She is comfortable with Google Forms and nothing more technical than that.
- **Participants.** About 30 or more anonymous people, mostly classmates, who open a shared link on a phone or a laptop and finish in a few minutes. English only.

## Product Purpose

GlanceLab tests several versions of a static ad where only one thing changes (in this study, where the promo price sits) and measures whether people notice and remember the price and how fast they find it. Success is: the researcher builds and publishes a study without help, participants complete it on any device, and she downloads a clean, anonymous CSV that the group can analyse for coursework.

## Positioning

A form builder whose steps are experiment building blocks: timed ad exposure with balanced random assignment to variants, a distractor task, recall questions, click-on-image, and a timed search scored against a target box. Google Forms cannot time a stimulus, assign variants or record reaction times; a full experiment toolkit needs a programmer.

## Operating Context

- The admin works alone, on a laptop, building and rebuilding forms, judging ad images whose colours and layout matter.
- Participants take part once, often several at the same moment in a classroom, on their own phones.
- The study is coursework: data is deleted after grading.

## Capabilities and Constraints

- Exactly one admin, from environment variables. No sign-up, no user management.
- Step types are a fixed menu: consent, text screen, ad exposure, distractor, question, click on image, timed search.
- Variants belong to the form; each participant is assigned one for the whole form, balanced across variants.
- Every form starts with a consent step that can be reworded but not removed.
- A published form accepts wording changes only.
- A timed step is never shown twice to one participant.
- Out of scope, deliberately: multiple admins, translations, analytics charts, webcam or eye tracking.
- Terminology the admin sees: study or form, step, variant, response, publish, preview. Never "slug", "payload", "session token".

## Brand Commitments

- Name: GlanceLab.
- The owner pinned the admin's visual reference: the dark, futuristic look of temporal.io (typography, colour, gradients, spacing), adapted and not copied. Agreed adaptation: dark shell, neutral editor canvas and image surfaces, with a light/dark toggle.
- The participant view stays plain, neutral and free of decoration so the interface cannot bias attention toward or away from the ad.

## Evidence on Hand

- No logo, illustrations or marketing copy exist. Do not invent testimonials, institutions or results.
- The ad images are supplied by the researcher at run time; none ship with the product.

## Product Principles

1. **The promise to participants is the product.** What the consent text says is collected, and nothing else, is what the system stores.
2. **Measurement comes before convenience.** Timing, assignment and "shown once" are never traded for a nicer flow.
3. **A non-programmer can run a real experiment.** Every control is in plain language and every destructive action says what will be lost.
4. **The interface stays out of the stimulus.** Around the ad, the product is as quiet as it can be.
5. **Small on purpose.** One admin, one server, one CSV.

## Accessibility & Inclusion

Participants use their own phones and laptops: large touch targets, readable text without zoom, keyboard-operable controls, and no reliance on colour alone. The admin panel supports keyboard reordering of steps.
