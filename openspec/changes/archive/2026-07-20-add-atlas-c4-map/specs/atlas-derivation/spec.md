## ADDED Requirements

### Requirement: Derived capability relations from co-change coupling
The daemon SHALL derive relations between settled capabilities mechanically from the archived changes, with no natural-language analysis and no reading of project source code: two capabilities SHALL be related when one or more archived changes added or modified both, and each relation SHALL carry a weight equal to the number of such changes together with the names of those changes. Relations SHALL be undirected — a pair SHALL yield exactly one relation regardless of the order the capabilities appear in — and SHALL be recomputed with the rest of the model rather than stored. A change that touches more than a small bounded number of capabilities SHALL be excluded from relation derivation, because a workspace-wide change couples every capability to every other and carries no distinguishing signal.

#### Scenario: Two capabilities changed together are related
- **WHEN** an archived change lists both `atlas-view` and `atlas-derivation` among the capabilities it adds or modifies
- **THEN** the model carries one relation between those two capabilities, whose weight counts that change and whose change list names it

#### Scenario: Weight accumulates across changes
- **WHEN** several archived changes each touch the same pair of capabilities
- **THEN** the relation's weight equals the number of those changes and its change list names each of them

#### Scenario: Relations are undirected and deduplicated
- **WHEN** archived changes list a pair of capabilities in differing orders
- **THEN** the model carries a single relation for that pair rather than one per ordering

#### Scenario: A sweeping change is excluded
- **WHEN** an archived change touches more capabilities than the derivation's fan-out bound
- **THEN** that change contributes no relations, and relations derived from other changes are unaffected

#### Scenario: A change touching one capability relates nothing
- **WHEN** an archived change adds or modifies exactly one capability
- **THEN** it contributes no relation, and the derivation does not error

#### Scenario: An empty archive yields no relations
- **WHEN** the project has no archived changes
- **THEN** the model carries an empty relation set and the building blocks are still assembled
