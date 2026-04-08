# Projects Page Hierarchy Design

## Goal

Restructure the projects page so it can highlight the most important projects with clear hierarchy, while preserving the existing visual world:

- Keep the galaxy background, stars, atmosphere, and current motion language.
- Keep the page feeling like the current site, not a generic portfolio grid.
- Change the project structure only.
- Keep the existing `More Projects` CTA at the end of the page.
- Reposition the GitHub icon so it supports the layout instead of floating awkwardly at the top center.

## Current Problem

The current page is built as a fixed constellation of equal project slots. That worked when the page showed five projects and one catch-all tile. It no longer creates a clear visual hierarchy.

Current issues:

- All projects compete for the same attention.
- The layout reads like six equal destinations instead of one flagship plus supporting products.
- The centered GitHub icon sits above the layout without belonging to the composition.
- The hard-coded slot layout is visually distinctive, but it is not intentional enough for the current project set.

## Approved Direction

Use a composed hierarchy layout with three levels:

1. One dominant flagship project.
2. Two secondary featured projects beside it.
3. Three equal supporting projects on the row below.

After those six projects, keep the existing `More Projects` button as a separate CTA.

There is no archive section on this page.

## Project Order

Display the featured projects in this exact order:

1. `Skylocation` -> `https://www.skylocation.app`
2. `Tokens4Breakfast` -> `https://www.tokens4breakfast.app`
3. `T-Minus AI` -> `https://www.tminusai.com`
4. `Tank Alert` -> `https://www.tankalert.de`
5. `Life Hacks Germany` -> `https://www.lifehacksgermany.com`
6. `Adidab` -> `https://www.adidab.com`

## Layout

### Top Section

Build the top section as an asymmetric composition:

- Left: one large flagship card for `Skylocation`
- Right: two stacked cards for `Tokens4Breakfast` and `T-Minus AI`

This section should feel composed, not like a standard three-column grid.

`Skylocation` must read as the flagship project at first glance through scale, spacing, and image dominance.

### Bottom Section

Place the remaining three projects in one balanced bottom row:

- `Tank Alert`
- `Life Hacks Germany`
- `Adidab`

These three cards should be equal in size and visually subordinate to the top section.

### CTA Section

Keep the existing `More Projects` button below the bottom row.

This remains a clean standalone CTA, not a fake project tile.

## GitHub Icon Placement

Move the GitHub icon out of the isolated top-center position.

New placement:

- Place it in the header band of the projects section, aligned to the top right of the content container.
- On desktop, it should sit above and to the right of the featured composition, not above the center axis.
- On mobile, it should collapse cleanly into the top flow without overlapping the cards.

Reason:

- The icon becomes a utility action instead of competing with `Skylocation` for the hero position.
- The top composition keeps a stronger focal point.
- The page gains a cleaner visual entry.

## Visual Rules

Preserve the existing environment and interaction language:

- Keep the galaxy background.
- Keep the stars and space atmosphere.
- Keep the current overall color direction.
- Keep the portal/constellation feel where it still fits the page.
- Keep the existing button style for `Back to Home` and `More Projects`, unless a small spacing adjustment is required.

Do not redesign the page into a flat modern grid. The change is structural hierarchy, not a visual reboot.

## Interaction Rules

Project cards must still function as direct links to their destinations.

Hierarchy rules:

- `Skylocation` gets the largest visual footprint.
- `Tokens4Breakfast` and `T-Minus AI` get strong secondary visibility.
- The bottom-row projects remain clean and readable, but they should not overpower the top row.

Hover behavior should remain consistent with the site style. It can be adapted to the new card sizes, but it should not introduce a new interaction model.

## Responsive Behavior

Desktop:

- Preserve the asymmetric top composition.
- Keep the bottom row at three equal cards if space allows.

Tablet:

- Keep hierarchy intact, even if spacing tightens.
- If needed, top-right stack can reduce in height before the layout collapses.

Mobile:

- Collapse into a single column.
- Preserve order and hierarchy through spacing and card sizing.
- `Skylocation` should still appear first and feel most prominent.
- GitHub icon must remain visible and aligned without covering content.

## Implementation Notes

The current page is duplicated in two HTML files:

- `fun-projects.html`
- `fun-projects/index.html`

The structure should be updated consistently in both.

The implementation should reduce slot-by-slot hard-coding where practical, but the immediate goal is the approved layout, not a full data-model refactor.

## Acceptance Criteria

The design is complete when all of the following are true:

- The page still uses the existing galaxy and atmospheric background.
- `Skylocation` is the clear flagship project.
- `Tokens4Breakfast` and `T-Minus AI` appear as secondary featured projects.
- `Tank Alert`, `Life Hacks Germany`, and `Adidab` appear in a balanced bottom row.
- `More Projects` remains as the final CTA below the featured projects.
- The GitHub icon has a deliberate placement that supports the composition.
- The page works cleanly on desktop and mobile.
- The result feels like the current site evolved, not replaced.
