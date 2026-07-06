## 1. Clipboard + toast primitive

- [x] 1.1 Add a `copyCommand(text)` helper in `public/app.js` that calls `navigator.clipboard.writeText(text)` and, on success, raises a toast; on failure (rejected promise), raises a toast telling the user to copy manually and shows the command text
- [x] 1.2 Add a lightweight toast mechanism (a single reused DOM node, auto-dismiss after a few seconds) and style it in `public/style.css` so it reads over both the light and dark themes
- [x] 1.3 Confirm the copy path works on `http://127.0.0.1` and `http://localhost` (secure-context origins) with no HTTPS

## 2. Weave action on the review banner

- [x] 2.1 In `renderReview`, append a **Weave** action button to the banner (shown only when the banner shows, i.e. at least one open change is `pending`)
- [x] 2.2 Wire the button to `copyCommand("/loom:weave")` with a toast like `Copied /loom:weave — paste into Claude Code`
- [x] 2.3 Adjust the banner copy so the button reads as the call to action without duplicating the existing "ask Claude to weave" sentence

## 3. Apply / Archive actions (card + detail panel)

- [x] 3.1 Add a shared helper that decides a change's card/detail action — `"apply"` when not archived, `readiness === "ready"`, and not complete (`totalTasks === 0 || completedTasks < totalTasks`); `"archive"` when not archived, `totalTasks > 0`, `completedTasks === totalTasks`; otherwise none — so `renderCard` and `renderChangeDetail` stay consistent
- [x] 3.2 In `renderChangeDetail`, render the resolved action as a button (Apply → `copyCommand("/opsx:apply " + c.name)`, Archive → `copyCommand("/opsx:archive " + c.name)`), placed consistently with the existing detail layout and the `detail-check` button pattern
- [x] 3.3 In `renderCard`, render the same resolved action as a compact button on the card, and call `stopPropagation()` in its handler so clicking it copies the command without also selecting the card / opening the detail
- [x] 3.4 Style the card action button and the detail action button in `public/style.css` (compact on the card; fits the tight card footprint without crowding the pills/next-up badge)
- [x] 3.5 Confirm no action renders for an archived change, that Apply and Archive are mutually exclusive, and that the card and detail always show the same action for a given change

## 4. Verification

- [x] 4.1 Run the daemon against a project with a `pending` proposal; confirm the review banner shows a Weave button that copies `/loom:weave` and toasts
- [x] 4.2 For a ready, in-progress change, confirm an Apply button copies `/opsx:apply <name>` (correct name embedded) from both its card and its detail panel
- [x] 4.3 For a change whose tasks are 100% complete but not archived, confirm an Archive button copies `/opsx:archive <name>` from both card and detail, and that no Apply button shows
- [x] 4.4 Confirm an archived change (from the done band) shows neither Apply nor Archive on its card or detail
- [x] 4.5 Confirm clicking a card's action copies the command but does not select the card / open the detail (propagation stopped)
- [x] 4.6 Confirm the dashboard makes no network call and triggers no daemon/agent activity when an action is clicked — it only writes to the clipboard and toasts (passivity preserved)
