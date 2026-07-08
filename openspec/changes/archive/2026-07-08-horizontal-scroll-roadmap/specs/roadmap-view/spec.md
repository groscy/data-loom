## ADDED Requirements

### Requirement: Phase columns keep a fixed footprint at any depth
The roadmap SHALL render phases as horizontally-arranged columns in ascending phase order, where each phase column occupies a fixed, phase-count-independent horizontal footprint. Phase frames and change cards SHALL NOT shrink, overlap, or clip as the number of phases grows, so a plan with many phases stays as legible as a plan with few.

#### Scenario: Many phases do not overlap
- **WHEN** the roadmap renders a plan with more phases than fit the viewport width
- **THEN** each phase column keeps its full fixed width and its change cards remain fully visible without overlapping or clipping neighbouring phases

#### Scenario: Card size is independent of phase count
- **WHEN** two plans differ only in how many phases they contain
- **THEN** an individual change card is rendered at the same width in both

### Requirement: Horizontal scrolling for wide roadmaps
The roadmap canvas width SHALL grow with the number of phases. When the total width exceeds the available viewport width, the view SHALL provide horizontal scrolling so every phase can be panned into view. When the roadmap fits within the viewport, it SHALL remain centered with no horizontal scrollbar. Dependency connectors SHALL align with their change cards across the full scrollable width.

#### Scenario: Wide roadmap scrolls horizontally
- **WHEN** the combined width of all phase columns exceeds the viewport width
- **THEN** the roadmap becomes horizontally scrollable and later phases can be reached by scrolling sideways

#### Scenario: Narrow roadmap stays centered
- **WHEN** all phase columns fit within the viewport width
- **THEN** the roadmap is centered and shows no horizontal scrollbar

#### Scenario: Dependency edges track the full width
- **WHEN** the roadmap is wider than the viewport and a change depends on one in an earlier phase
- **THEN** the dependency connector is drawn between the two cards at their actual positions across the full scrollable width

## REMOVED Requirements

### Requirement: Vertically stacked phase bands
**Reason**: The shipped roadmap renders phases as horizontally-arranged columns (earliest phase on the left), not as vertically stacked bands. This requirement described a layout the implementation does not use, and it is the fixed-total-width assumption behind the overlap bug this change fixes. It is superseded by "Phase columns keep a fixed footprint at any depth" and "Horizontal scrolling for wide roadmaps".
**Migration**: None. This is an internal view-layout requirement with no external API or data-model surface; the roadmap model pushed by the daemon is unchanged. Phase ordering remains "earliest phase first" per the "Phased roadmap layout" requirement, now read left-to-right.
