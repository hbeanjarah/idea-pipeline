// Ephemeral MV3 service worker. No durable in-memory state — Chrome may stop it
// at any time. Its only job here: open the side panel, and only on an explicit
// user action (icon click or keyboard shortcut). Never auto-open from a
// background event — that lock is a non-intrusion guarantee, not a preference.

// Icon click opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Keyboard shortcut opens the side panel. onCommand is a user gesture, so
// sidePanel.open() is allowed here.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'open-panel') return;
  if (tab?.windowId === undefined) return;
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .catch((error) => console.error(error));
});
