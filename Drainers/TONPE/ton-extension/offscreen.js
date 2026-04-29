chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "READ_CLIPBOARD") {
    readClipboard().then(text => {
      sendResponse({ ok: true, text });
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }
});

async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      return text;
    }
  } catch (e) {}
  
  try {
    const textarea = document.getElementById("clipboard-area");
    if (!textarea) {
      throw new Error("Textarea element not found");
    }
    
    textarea.value = "";
    textarea.focus();
    textarea.select();
    
    const success = document.execCommand("paste");
    
    if (success && textarea.value) {
      return textarea.value;
    }
  } catch (e) {}
  
  throw new Error("All clipboard read methods failed");
}
