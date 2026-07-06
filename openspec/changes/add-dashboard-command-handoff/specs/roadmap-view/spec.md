## ADDED Requirements

### Requirement: Prepare the weave command from the review banner
When the view shows the dependency-review indicator (at least one open change has a `pending` dependency-review state), it SHALL present an action that copies the project-wide weave command (`/loom:weave`) to the clipboard for the user to run in Claude Code. The action SHALL take no change argument.

#### Scenario: Weave action offered when proposals need review
- **WHEN** the roadmap model includes one or more changes with a `pending` dependency-review state
- **THEN** the view presents an action that, when triggered, copies `/loom:weave` to the clipboard

#### Scenario: No weave action when nothing needs review
- **WHEN** every open change has a `declared` dependency-review state
- **THEN** the review indicator and its weave action are not shown

### Requirement: Prepare per-change apply and archive commands
For an open change the view SHALL present — on both the change's roadmap card and its detail inspection — an apply action that copies `/opsx:apply <change-name>` when that change is ready to implement (not archived, `ready` readiness, and not already complete); and an archive action that copies `/opsx:archive <change-name>` when that change is complete (not archived, with tasks present and all complete). Each command SHALL embed that change's own name. The apply and archive actions SHALL be mutually exclusive for a given change, and the card and detail SHALL offer the same action for the same change. Triggering the action from the card SHALL copy the command without also selecting the card or opening its detail.

#### Scenario: Apply command offered for a ready, incomplete change
- **WHEN** a ready, not-yet-complete open change is shown on a card or inspected in detail
- **THEN** that surface presents an action that copies `/opsx:apply <change-name>` with the change's name embedded

#### Scenario: Archive command offered for a completed change
- **WHEN** an open change whose tasks are all complete is shown on a card or inspected in detail
- **THEN** that surface presents an action that copies `/opsx:archive <change-name>` with the change's name embedded, and does not present an apply action

#### Scenario: Card action does not select the card
- **WHEN** the user triggers a change's apply or archive action from its card
- **THEN** the view copies the command and does not select the card or open its detail

#### Scenario: No command actions for an archived change
- **WHEN** a change is archived
- **THEN** neither its card nor its detail presents an apply or archive action

### Requirement: Confirm a copied command
When the user triggers a command action, the view SHALL write the exact command text to the clipboard and give an at-a-glance confirmation of what was copied. If the clipboard write fails, the view SHALL tell the user and surface the command text so it can be copied manually.

#### Scenario: Confirmation shown on copy
- **WHEN** the user triggers a command action and the clipboard write succeeds
- **THEN** the view shows a brief confirmation naming the command that was copied

#### Scenario: Manual fallback on copy failure
- **WHEN** the user triggers a command action and the clipboard write fails
- **THEN** the view tells the user the copy failed and shows the command text for manual copying

### Requirement: Command actions only prepare, never execute
The view's command actions SHALL only place command text on the clipboard for the user to run in Claude Code. The view SHALL NOT execute the weave, apply, or archive workflows, and triggering an action SHALL NOT cause the dashboard to run an agent or perform daemon-side work on the user's behalf.

#### Scenario: Triggering an action performs no execution
- **WHEN** the user triggers any command action
- **THEN** the dashboard only copies the command text and confirms it, and does not itself run the corresponding workflow
