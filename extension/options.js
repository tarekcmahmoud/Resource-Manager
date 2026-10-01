const input = document.getElementById('app');
const status = document.getElementById('status');

chrome.storage.sync.get('app').then(({ app }) => { if (app) input.value = app; });

function save() {
  let url;
  try { url = new URL(input.value.trim()); } catch { url = null; }
  if (!url || !/^https?:$/.test(url.protocol)) {
    status.className = 'err';
    status.textContent = 'Paste a full address starting with https://';
    return;
  }
  // The panel talks to the app with your sign-in, which needs Chrome's permission for that address.
  chrome.permissions.request({ origins: [`${url.origin}/*`] }).then((granted) => {
    if (!granted) {
      status.className = 'err';
      status.textContent = 'Saving needs permission to reach that address. Click Save again and choose Allow.';
      return;
    }
    return chrome.storage.sync.set({ app: url.origin }).then(() => {
      input.value = url.origin;
      status.className = '';
      status.textContent = 'Saved. You can close this tab.';
    });
  });
}
document.getElementById('save').addEventListener('click', save);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
