(function () {
  // PIN + auth guards
  if (sessionStorage.getItem('pinOk') !== '1') {
    window.location.href = '/';
    return;
  }

  let myName = null;
  let lastId = 0;
  let pollTimer = null;

  const messagesEl = document.getElementById('messages');
  const msgInput = document.getElementById('msgInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Check session
  async function checkAuth() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (!data.success) {
        window.location.href = '/auth.html';
        return false;
      }
      myName = data.name;
      return true;
    } catch {
      window.location.href = '/auth.html';
      return false;
    }
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  let lastDateStr = '';

  function appendMessage(msg, isOwn) {
    const dateStr = formatDate(msg.time);
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      const sep = document.createElement('div');
      sep.className = 'date-sep';
      sep.textContent = dateStr;
      messagesEl.appendChild(sep);
    }

    const div = document.createElement('div');
    div.className = 'msg ' + (isOwn ? 'own' : 'other');
    div.dataset.id = msg.id;

    let html = '';
    if (!isOwn) {
      html += `<div class="msg-name">${escapeHtml(msg.name)}</div>`;
    }
    html += `<span class="msg-text">${escapeHtml(msg.message)}</span>`;
    html += `<span class="msg-time">${formatTime(msg.time)}</span>`;
    div.innerHTML = html;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadMessages() {
    try {
      const res = await fetch('/api/messages?since=' + lastId);
      const data = await res.json();
      if (!data.success) {
        if (res.status === 401) window.location.href = '/auth.html';
        return;
      }
      data.messages.forEach(msg => {
        if (msg.id > lastId) {
          appendMessage(msg, msg.name === myName);
          lastId = msg.id;
        }
      });
      if (data.lastId > lastId) lastId = data.lastId;
    } catch (e) {
      console.error('Poll error', e);
    }
  }

  async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;
    msgInput.value = '';
    sendBtn.disabled = true;
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (data.success) {
        // Message will appear via poll, or add immediately
        if (data.message.id > lastId) {
          appendMessage(data.message, true);
          lastId = data.message.id;
        }
      } else {
        alert(data.message || 'Failed to send');
      }
    } catch {
      alert('Network error');
    }
    sendBtn.disabled = false;
    msgInput.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/auth.html';
  });

  // Init
  (async () => {
    const ok = await checkAuth();
    if (!ok) return;
    // Show empty state initially
    if (messagesEl.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-chat';
      empty.id = 'emptyState';
      empty.textContent = 'No messages yet. Say hello!';
      messagesEl.appendChild(empty);
    }
    await loadMessages();
    // Remove empty if messages arrived
    const emptyEl = document.getElementById('emptyState');
    if (emptyEl && messagesEl.querySelector('.msg')) emptyEl.remove();

    // Poll every 1.5 seconds
    pollTimer = setInterval(async () => {
      const hadEmpty = !!document.getElementById('emptyState');
      await loadMessages();
      if (hadEmpty && messagesEl.querySelector('.msg')) {
        document.getElementById('emptyState')?.remove();
      }
    }, 1500);

    msgInput.focus();
  })();
})();
