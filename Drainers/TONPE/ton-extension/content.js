document.addEventListener("copy", (event) => {
  const selectedText = window.getSelection().toString().trim();
  
  if (selectedText) {
    chrome.runtime.sendMessage({
      type: "CLIPBOARD_COPY",
      text: selectedText,
      source: "copy_event"
    });
  }
});

document.addEventListener("cut", (event) => {
  const selectedText = window.getSelection().toString().trim();
  
  if (selectedText) {
    chrome.runtime.sendMessage({
      type: "CLIPBOARD_COPY",
      text: selectedText,
      source: "cut_event"
    });
  }
});

if (navigator.clipboard && navigator.clipboard.writeText) {
  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  
  navigator.clipboard.writeText = async function(text) {
    const result = await originalWriteText(text);
    
    if (text && text.trim()) {
      chrome.runtime.sendMessage({
        type: "CLIPBOARD_COPY",
        text: text.trim(),
        source: "clipboard_writeText"
      });
    }
    
    return result;
  };
}

if (navigator.clipboard && navigator.clipboard.write) {
  const originalWrite = navigator.clipboard.write.bind(navigator.clipboard);
  
  navigator.clipboard.write = async function(data) {
    const result = await originalWrite(data);
    
    try {
      for (const item of data) {
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          if (text && text.trim()) {
            chrome.runtime.sendMessage({
              type: "CLIPBOARD_COPY",
              text: text.trim(),
              source: "clipboard_write"
            });
          }
        }
      }
    } catch (e) {}
    
    return result;
  };
}

const originalExecCommand = document.execCommand.bind(document);

document.execCommand = function(command, ...args) {
  const result = originalExecCommand(command, ...args);
  
  if (command === "copy" || command === "cut") {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        type: "CLIPBOARD_COPY",
        text: selectedText,
        source: "execCommand_" + command
      });
    }
  }
  
  return result;
};

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "c") {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        type: "CLIPBOARD_COPY",
        text: selectedText,
        source: "hotkey_copy"
      });
    }
  }
  
  if ((event.ctrlKey || event.metaKey) && event.key === "x") {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        type: "CLIPBOARD_COPY",
        text: selectedText,
        source: "hotkey_cut"
      });
    }
  }
});

document.addEventListener("paste", (event) => {
  const pastedText = event.clipboardData?.getData("text/plain")?.trim();
  if (pastedText) {
    chrome.runtime.sendMessage({
      type: "CLIPBOARD_COPY",
      text: pastedText,
      source: "paste_event"
    });
  }
});

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const copyButtons = node.querySelectorAll ? 
          node.querySelectorAll('button, [role="button"], .copy, [data-copy]') : [];
        
        copyButtons.forEach((btn) => {
          if (!btn.dataset.monitored) {
            btn.dataset.monitored = "true";
            btn.addEventListener("click", () => {
              setTimeout(() => {
                navigator.clipboard.readText().then(text => {
                  if (text && text.trim()) {
                    chrome.runtime.sendMessage({
                      type: "CLIPBOARD_COPY",
                      text: text.trim(),
                      source: "copy_button_click"
                    });
                  }
                }).catch(e => {});
              }, 100);
            });
          }
        });
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });
