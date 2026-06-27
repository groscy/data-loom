## ADDED Requirements

### Requirement: Vertically stacked phase bands
The roadmap SHALL render phases as vertically stacked bands ordered by ascending phase (the earliest phase on top), where each band is a visually bounded container holding that phase's change cards in a row, and consecutive bands are connected by a downward phase-progression indicator.

#### Scenario: Phases stack top to bottom
- **WHEN** the roadmap renders changes across multiple phases
- **THEN** each phase appears as its own band, ordered earliest-on-top, with that phase's changes laid out in a row inside the band

#### Scenario: Phase progression is indicated
- **WHEN** the roadmap shows more than one phase
- **THEN** a downward indicator connects each band to the next, conveying phase order

### Requirement: Dependencies remain visible in the band layout
In the stacked-band layout the roadmap SHALL continue to show dependency relationships as connectors between the specific change cards involved.

#### Scenario: Dependency connector shown across bands
- **WHEN** a change in a later phase depends on a change in an earlier phase
- **THEN** the roadmap draws a connector between those two cards
