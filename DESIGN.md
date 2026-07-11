---
name: VoyageBus
description: Calm, dependable intercity bus booking.
colors:
  voyage-navy: "#102F45"
  voyage-teal: "#0F766E"
  voyage-teal-deep: "#0A5C56"
  signal-orange: "#F97316"
  true-off-white: "#FAFAF9"
  surface: "#FFFFFF"
  ink: "#132C3D"
  muted: "#5F707C"
  line: "#D9E2E1"
typography:
  display:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "3.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.voyage-teal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
---

# Design System: VoyageBus

## 1. Overview

**Creative North Star: "The Quiet Departure Lounge"**

VoyageBus should feel like a composed, well-run departure lounge: calm enough to think, precise enough to trust, and clearly connected to real travel. The supplied SmartBus screens are the baseline. Improvements should sharpen their hierarchy, spacing, imagery, and component consistency without replacing their editorial character.

The interface rejects generic landing-page scaffolding, invented social proof, decorative card collections, and visual effects without product purpose. Brand expression comes from deep navy, controlled teal, authentic Indian travel photography, disciplined type, and small moments of orange urgency.

**Key Characteristics:** restrained, information-first, editorial at major moments, compact in workflows, and responsive by structure.

## 2. Colors

Deep navy provides continuity and trust; teal identifies VoyageBus actions; orange is rare and meaningful.

### Primary
- **Voyage Teal** (#0F766E): primary actions, active navigation, selected seats, and focus treatment.
- **Voyage Navy** (#102F45): hero surfaces, trip headers, strong text, and ticket identity.

### Secondary
- **Signal Orange** (#F97316): offers, urgency, warnings, and small highlights only.

### Neutral
- **True Off-White** (#FAFAF9): page background without beige tint.
- **Surface White** (#FFFFFF): forms and contained workflow surfaces.
- **Travel Ink** (#132C3D): primary copy and data.
- **Route Gray** (#5F707C): supporting text.
- **Quiet Line** (#D9E2E1): dividers and field borders.

**The Signal Rule.** Orange communicates something exceptional; it never becomes the default action color.

## 3. Typography

**Display Font:** Georgia (with Times New Roman fallback)
**Body Font:** Inter (with system sans-serif fallback)

**Character:** Serif creates an editorial sense of journey for hero, booking confirmation, and major trip identity. Inter carries every control, label, result, and piece of operational information.

### Hierarchy
- **Display** (600, up to 3.5rem, 1.05): homepage hero and confirmation moment only.
- **Headline** (700, 2rem, 1.15): major page titles.
- **Title** (700, 1.125rem, 1.3): cards and workflow sections.
- **Body** (400, 1rem, 1.6): prose capped at 70ch.
- **Label** (700, 0.75rem, 0.02em): concise field and status labels.

**The Editorial Restraint Rule.** Serif is reserved for major moments, never buttons, filters, field labels, or dense result data.

## 4. Elevation

VoyageBus is flat by default. Depth comes from surface contrast and dividers. Compact shadows appear only on floating search, mobile sheets, menus, and interactive hover states; never pair a wide ambient shadow with a decorative one-pixel card border.

**The Flat-by-Default Rule.** Surfaces earn elevation through interaction or spatial necessity.

## 5. Components

### Buttons
- **Shape:** controlled medium radius (10–12px), never inflated.
- **Primary:** Voyage Teal with white text and concise verb-object labels.
- **Hover / Focus:** deepen teal on hover; use a visible two-pixel focus ring with offset.
- **Secondary:** white or transparent with Quiet Line border.

### Chips
- **Style:** compact, low-chroma surface with text and an icon or label.
- **State:** selected state uses both fill and a visible check or icon change.

### Cards / Containers
- **Corner Style:** 12–16px maximum.
- **Background:** white over true off-white.
- **Shadow Strategy:** flat at rest; short shadow on meaningful hover only.
- **Border:** use dividers or a full quiet border, never an accent stripe.
- **Internal Padding:** 16–24px depending on density.

### Inputs / Fields
- **Style:** white surface, quiet border, 8px radius, persistent labels.
- **Focus:** teal border and visible focus ring.
- **Error / Disabled:** icon plus text; never color alone.

### Navigation

Compact white top navigation with a restrained VoyageBus wordmark, clear active state, and account actions. Mobile navigation becomes a task-focused bottom bar or sheet only where it improves reachability.

### Seat Map

Seats use shape, iconography, text labels, and color together. Selection responds immediately within 150–220ms and updates a persistent booking summary.

## 6. Do's and Don'ts

### Do:
- **Do** preserve the supplied screenshots’ calm composition and editorial hierarchy.
- **Do** use authentic Indian road-travel imagery with useful crops and restrained overlays.
- **Do** use teal for primary action, navy for trust, and orange for exceptional signals.
- **Do** keep every interaction keyboard accessible and respect reduced motion.
- **Do** derive route, fare, seat, and booking information from real application data.

### Don't:
- **Don't** make VoyageBus resemble a generic AI-generated landing page.
- **Don't** add fabricated statistics, testimonials, claims, or dead promotional controls.
- **Don't** repeat equal-sized icon-heading-text cards as page scaffolding.
- **Don't** use gradient text, decorative glassmorphism, accent side stripes, or oversized card radii.
- **Don't** animate page entrances or add floating decorative motion.
- **Don't** replace familiar booking affordances merely to make the interface look novel.
