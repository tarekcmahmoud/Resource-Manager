// Right-click items hand the image or link to the toolbar panel (popup.js), which then
// opens in place. If Chrome won't open the panel, the app's full save form opens in a window.

async function appAddress() {
  const { app } = await chrome.storage.sync.get('app');
  return app || '';
}

async function openWindow(params) {
  const app = await appAddress();
  if (!app) { chrome.runtime.openOptionsPage(); return; }
  const url = new URL('/save', app);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  chrome.windows.create({ url: url.href, type: 'popup', width: 680, height: 860, focused: true });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'page', title: 'Save page to the wall', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'image', title: 'Save image to the wall', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'link', title: 'Save link to the wall', contexts: ['link'] });
  });
  if (!(await appAddress())) chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const pending =
    info.menuItemId === 'image' ? { image: info.srcUrl, page: info.pageUrl, title: tab?.title }
      : info.menuItemId === 'link' ? { link: info.linkUrl }
        : { page: info.pageUrl, title: tab?.title };
  await chrome.storage.session.set({ pending: { ...pending, at: Date.now() } });
  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.storage.session.remove('pending');
    openWindow(pending.link ? { url: pending.link } : { url: pending.page, title: pending.title, image: pending.image });
  }
});
