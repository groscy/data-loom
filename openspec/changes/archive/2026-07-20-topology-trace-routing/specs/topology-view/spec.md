## ADDED Requirements

### Requirement: Connections are routed within the hub-to-card corridor
Each server's connection SHALL be routed entirely within the corridor between the hub chip and that server's card column. The segment that meets the card SHALL always run toward the card, never away from it; the connection SHALL NOT pass behind or through the card column; and it SHALL NOT be drawn outside the canvas. These SHALL hold at every server count, so adding servers tightens the spacing between connections rather than pushing any of them out of the corridor.

#### Scenario: Final segment always runs toward the card
- **WHEN** the topology renders any number of servers
- **THEN** every connection's last segment runs from its turning point toward that server's card, never doubling back

#### Scenario: Connections stay clear of the card column
- **WHEN** the topology renders enough servers that the connections are tightly spaced
- **THEN** no connection's turning point falls within or beyond the card column, so no connection is drawn behind a card

#### Scenario: Connections stay on the canvas
- **WHEN** the topology renders a server count large enough to exhaust the preferred spacing
- **THEN** the spacing between connections tightens and every connection remains within the canvas bounds

#### Scenario: Small topologies are unchanged
- **WHEN** the servers fit within the preferred connection spacing
- **THEN** each connection is routed exactly where it was before the spacing could tighten
