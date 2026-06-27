## 1. App icon asset

- [x] 1.1 Design `public/icon.svg`: a rounded-square tile with an over/under weave of two threads (accent blue + green) and node dots at the intersections; legible at 16px

## 2. UI branding (browser surfaces)

- [x] 2.1 Add `<link rel="icon" type="image/svg+xml" href="/icon.svg">` to `index.html`
- [x] 2.2 Replace the header `data_loom` wordmark with the icon logo + "DataLoom"
- [x] 2.3 Set the page `<title>` to "DataLoom"
- [x] 2.4 Serve `icon.svg` (filesystem in dev; embed it as a SEA asset for the exe)

## 3. Name in docs

- [x] 3.1 Update the README to refer to the app as "DataLoom" and to the `DataLoom.exe` download

## 4. Executable identity

- [x] 4.1 Add a packaging step that rasterizes `public/icon.svg` to PNGs and builds `build/icon.ico` (SVG rasterizer + png-to-ico)
- [x] 4.2 Output the executable as `DataLoom.exe` and set the app icon on it with `rcedit` before the postject injection
- [x] 4.3 Update the release workflow and README to publish/reference `DataLoom.exe`

## 5. Verification

- [x] 5.1 Load the dashboard and confirm the header shows the icon + "DataLoom", the title is "DataLoom", and the favicon appears
- [x] 5.2 Build the exe and confirm it is named `DataLoom.exe`, launches, and shows the app icon (Explorer/taskbar)
- [x] 5.3 Confirm `icon.svg` is served by the running daemon and embedded in the exe
