# Installing the "Save to wall" Chrome extension

This extension saves the page you're on, a link or an image to a Resource Manager wall without leaving the page. It isn't on the Chrome Web Store, so you load it yourself. It takes about two minutes.

(The same steps are on the app's Dev page. If you change one copy, update the other.)

## Before you start

- Chrome, or another Chromium browser such as Arc, Brave or Edge.
- An account on the Resource Manager app, and the app's address (for example `https://resource-manager-….vercel.app`).
- Sign in to the app in that browser once. The extension saves using that sign-in.

## Install

1. **Unzip** the download. You get a folder called `resource-manager-extension`. Keep it somewhere permanent, such as Documents: Chrome loads the extension from this folder every time, so don't delete or move it later.
2. Open **chrome://extensions** in the address bar.
3. Turn on **Developer mode** (the switch in the top-right corner).
4. Click **Load unpacked** and choose the `resource-manager-extension` folder (the one that contains `manifest.json`).
5. The extension's **settings page** opens. Paste the app's address, click **Save**, and choose **Allow** when Chrome asks for permission to reach that address.
6. **Pin it** so it's easy to reach: click the puzzle-piece icon in Chrome's toolbar, then the pin next to "Resource Manager: save to wall".

## Use

- **Save the page you're on:** click the toolbar button, or press **⌥⇧S** (Alt+Shift+S on Windows). A panel opens under the button.
- **Save an image or a link:** right-click it and choose "Save image to the wall" or "Save link to the wall".
- **In the panel:** click images to pick them (they're numbered in the order you pick), add a title, a note and tags, then click **Save to wall**.
- **Full form** opens the app's complete form in a window, for quotes, text, video, type, width and boards.

## Update to a new version

Download and unzip the new version into the **same folder**, replacing the old files. Then click the **reload** icon (↻) on the extension's card in chrome://extensions.

## If something goes wrong

- **"Sign in first" while you're signed in:** open the app in a tab, sign out and sign in again, then try the panel again. If it still happens, tell the developer: the extension may need its own sign-in step.
- **"One more permission":** click Allow. If you closed the prompt, open the extension's settings and click Save again.
- **No images in the grid:** some pages only load images when you scroll. Scroll the page, then open the panel again. You can always save the page without images.
- **The panel doesn't open on a page:** Chrome doesn't let extensions read its own pages (chrome://, the Web Store). Use it on normal websites.
