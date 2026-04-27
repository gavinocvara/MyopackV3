\# MyoPack



Senior Design 2 capstone project for EMG biofeedback / rehabilitation monitoring.  

This is a functional Next.js app that must be transformed into a premium, clinically credible, presentation-ready health-tech product without breaking real functionality.



\## Primary Mission



Redesign the presentation layer aggressively while preserving:

\- working logic

\- routes

\- calculations

\- monitoring behavior

\- data flow

\- core architecture unless safe refactors are clearly better



The target outcome is a premium health-tech application with the level of product quality, coherence, hierarchy, and polish expected from elite wellness and biometric software.



\## Product Goal



MyoPack should feel:

\- premium

\- calm

\- clinically trustworthy

\- modern

\- original

\- polished enough for capstone presentation and future productization



MyoPack must NOT feel:

\- student-grade

\- generic

\- template-based

\- cluttered

\- repetitive

\- like a basic dark dashboard

\- like a rushed prototype



\## Quality Standard



The redesign fails if:

\- the app still resembles the old layout structure

\- cards are repetitive and equal-weight

\- spacing feels cramped

\- hierarchy is weak

\- typography feels cheap

\- surfaces feel flat or noisy

\- color feels immature or random

\- monitoring behavior is visually or logically incorrect

\- the premium difference is not obvious within 2 seconds



The redesign succeeds only if:

\- the app feels like one coherent product system

\- hierarchy is obvious immediately

\- the top insight dominates appropriately

\- the shell feels intentional

\- motion feels refined

\- monitoring logic remains correct

\- the product is strong enough to present proudly at Senior Design



\## Project Context



MyoPack is an EMG-focused rehabilitation / biofeedback product.  

The app already exists and works.  

The problem is not “make it functional.”  

The problem is “replace a basic-looking interface with a premium product experience.”



This project should be approached like:

\- health-tech product design

\- premium mobile/web app refinement

\- information design for biometrics

\- capstone-grade software engineering polish



\## Product Strategy



Use the strongest principles from elite wellness / biometric apps without cloning them literally.



Design principles to adapt:

\- one major insight first

\- separate immediate/live state from deeper vitals and long-term progress

\- use color as meaningful state communication, not decoration

\- organize information by relevance and timing

\- reduce visual noise

\- let navigation recede and content dominate

\- use modular dashboards with primary, secondary, and tertiary hierarchy

\- use calm, refined motion

\- use premium surface layering and spacing rather than loud borders



Do NOT copy another product literally.  

Do create an original MyoPack identity that can compete in perceived quality.



\## Core Page Strategy



\### Today

This is the flagship page.

It must communicate:

\- what is happening now

\- whether the monitored state looks healthy or concerning

\- the most important live insight first

\- supporting live metrics second

\- deeper detail below



Today should not be a stack of equal-weight cards.



\### Vitals

This is the live instrumentation page.

It should feel:

\- precise

\- high-confidence

\- clean

\- data-trustworthy

\- premium



Use stronger grouping and better summary-vs-detail separation.



\### Health

This is the long-term rehab/progress page.

It should focus on:

\- trends

\- consistency

\- progress

\- balance over time

\- session history

\- longitudinal meaning



It must not feel like a debug or admin page.



\## Monitoring Behavior Rules



IMPORTANT:

When monitoring stops, all live EMG-driven displayed values must freeze immediately at their last valid values.



Unacceptable behavior:

\- percentages continue updating after stop

\- duplicate intervals spawn after repeated start/stop

\- state updates continue after stop

\- animations continue receiving changing data after stop



Required behavior:

\- clear all monitoring intervals on stop

\- no duplicate intervals

\- robust repeated start/stop handling

\- freeze displayed values on stop

\- preserve monitoring accuracy while redesigning UI



If there is a conflict between visual polish and monitoring correctness, preserve correctness first.



\## UI / UX Direction



Target visual qualities:

\- premium

\- original

\- calm

\- elegant

\- low-glare

\- medically credible

\- spacious

\- refined

\- high-trust



Avoid:

\- generic SaaS dashboard patterns

\- card spam

\- overuse of borders

\- loud neon

\- fake futuristic gimmicks

\- childish saturation

\- cheap glassmorphism

\- startup gradients

\- cluttered widget layouts

\- repetitive equal-size blocks



Prefer:

\- layered surfaces

\- stronger whitespace rhythm

\- softer separators

\- disciplined accent usage

\- premium typography

\- asymmetry where useful

\- obvious information hierarchy

\- elegant metric framing

\- more intentional empty/loading/error states



\## Motion Rules



Motion should feel:

\- composed

\- expensive

\- subtle

\- purposeful

\- smooth

\- precise



Use motion to:

\- clarify hierarchy

\- smooth state changes

\- improve perceived quality

\- make live monitoring feel credible

\- refine navigation and transitions



Do NOT use:

\- pointless bounce

\- flashy gimmicks

\- loud entrance animation

\- motion that competes with the content



Always respect prefers-reduced-motion.



\## Color Rules



Use a restrained palette.

Prioritize harmony and credibility over novelty.



Preferred direction:

\- premium dark or low-glare foundation

\- balanced neutrals

\- disciplined coral accent

\- semantic status colors only when meaningful

\- better tonal range between surfaces

\- stronger contrast hierarchy without harshness



Color should:

\- help identify state

\- improve scanability

\- increase trust

\- reinforce hierarchy



Color should NOT:

\- feel random

\- feel playful

\- overpower the content

\- look like a generic template



\## Typography Rules



Typography should feel premium, readable, and serious.



Required:

\- stronger hierarchy

\- better label discipline

\- cleaner metric emphasis

\- confident hero numbers / hero insight

\- fewer weak tiny labels

\- readable mobile-first scaling



Do not let typography feel:

\- cramped

\- cheap

\- inconsistent

\- like default dashboard text



\## Layout Rules



General requirements:

\- mobile-first, then tablet/desktop refinement

\- avoid repetitive equal-weight layouts

\- use primary / secondary / tertiary hierarchy

\- use larger hero zones where justified

\- use spacing and containment to organize the page

\- use modular blocks, not cookie-cutter card grids



Do not preserve existing layout patterns just because they already work.



\## Engineering Rules



Preserve:

\- business logic

\- monitoring logic

\- route paths where possible

\- existing functionality unless a safe refactor is clearly better



Allowed:

\- rewrite JSX aggressively

\- replace weak components

\- create new shared primitives

\- restructure page composition

\- replace styling systems

\- improve responsiveness

\- fix state bugs

\- improve performance if safe



Do NOT:

\- leave half-finished redesign fragments

\- add placeholder functionality

\- break builds

\- silently change important behavior

\- fake important data



\## Preferred Workflow



For any major redesign or refactor:

1\. inspect existing code first

2\. understand current behavior

3\. identify weak UI architecture and visual anti-patterns

4\. define the improved structure

5\. implement the redesign

6\. verify logic still works

7\. critique the result harshly

8\. refine again until premium



Do not stop after the first pass if the work still feels generic.



\## Agent Team Model



When using agent teams or subagents, use these roles:

\- Orchestrator / Product Director

\- Oura Intelligence Analyst

\- Competitive Product Analyst

\- Visual Systems Director

\- Interaction + Motion Director

\- Frontend Architect

\- Health Dashboard Strategist

\- Monitoring Logic Guardian

\- QA / Taste Judge



\### Shared agent mission

Transform MyoPack into a premium health-tech product by combining:

\- preserved functionality

\- elite hierarchy

\- original visual identity

\- refined motion

\- stronger app shell

\- better metric framing

\- continuous critique and improvement



\### Agent rules

\- no agent may break core logic

\- no agent may preserve weak student-grade patterns

\- QA / Taste Judge can reject weak work

\- Monitoring Logic Guardian must verify monitoring correctness

\- all pages must feel like one product system



\## File / Architecture Notes



This is a Next.js app.  

Read the current codebase before making architectural assumptions.  

Do not invent patterns that are not supported by the repo.  

Prefer extending or replacing existing structures cleanly over layering hacks on top of weak code.



If adding new components:

\- keep them reusable

\- keep them purposeful

\- avoid duplication

\- make them support the full product system



\## Commands



```bash

npm install

npm run dev

npm run build

npm run lint

```



If a command fails, inspect the existing repo setup rather than guessing.



\## Implementation Priorities



Priority order:

1\. preserve and verify logic

2\. fix monitoring stop/start behavior

3\. rebuild shell and shared UI system

4\. redesign Today page

5\. redesign Vitals page

6\. redesign Health page

7\. polish motion, color, surfaces, and spacing

8\. final QA for presentation readiness



\## Final Standard



Assume the user wants excellence, not “good enough.”



Do not aim for:

\- nice

\- decent

\- cleaner

\- acceptable



Aim for:

\- elite

\- coherent

\- polished

\- memorable

\- presentation-ready

\- worthy of continued development after graduation

