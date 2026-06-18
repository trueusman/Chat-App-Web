// ==================== STATE ====================
const state = {
  user: null,
  socket: null,
  conversations: [],
  friends: [],
  allUsers: [],
  pendingRequests: { sent: [], received: [] },
  activeConversationId: null,
  messages: [],
  typingTimers: {},
  activeTab: 'chats',
  searchQuery: '',
  onlineUsers: new Set(),
};

// ==================== UTILS ====================
function defaultAvatar(name) {
  const n = name || '?';
  const initials = n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23128C7E"/><text x="20" y="27" font-size="16" text-anchor="middle" fill="white" font-family="sans-serif">${encodeURIComponent(initials)}</text></svg>`;
}
window.defaultAvatar = (name) => defaultAvatar(name);

function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMsgTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function avatarImg(user, size = 'w-10 h-10') {
  const src = user.profileImage || defaultAvatar(user.name);
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(user.name)}" class="${size} rounded-full object-cover bg-gray-200 flex-shrink-0" onerror="this.src='${defaultAvatar(user.name)}'" />`;
}

function isOnline(userId) {
  return state.onlineUsers.has(userId);
}

function onlineBadge(userId) {
  const online = isOnline(userId);
  return `<span class="w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-primary' : 'bg-gray-300'} flex-shrink-0"></span>`;
}

// ==================== SOCKET ====================
function initSocket() {
  const token = localStorage.getItem('token');
  state.socket = io({ auth: { token }, path: '/socket.io' });

  state.socket.on('connect', () => console.log('Socket connected'));
  state.socket.on('connect_error', (err) => console.warn('Socket error', err.message));

  state.socket.on('user-online', ({ userId }) => {
    state.onlineUsers.add(userId);
    updateOnlineIndicators(userId, true);
  });

  state.socket.on('user-offline', ({ userId }) => {
    state.onlineUsers.delete(userId);
    updateOnlineIndicators(userId, false);
  });

  state.socket.on('incoming-friend-request', ({ request }) => {
    state.pendingRequests.received.unshift(request);
    updateRequestsBadge();
    showToast(`${request.sender.name} sent you a friend request`, 'info');
    if (state.activeTab === 'requests') renderSidebarList();
  });

  state.socket.on('friend-request-sent', ({ request }) => {
    const idx = state.pendingRequests.sent.findIndex(r => r._id === request._id);
    if (idx === -1) state.pendingRequests.sent.push(request);
    if (state.activeTab === 'requests' || state.activeTab === 'people') renderSidebarList();
  });

  state.socket.on('friend-request-accepted', async ({ request }) => {
    showToast(`${request.sender.name} accepted your friend request`, 'success');
    await loadFriends();
    await loadConversations();
    state.pendingRequests.sent = state.pendingRequests.sent.filter(r => r._id !== request._id);
    updateRequestsBadge();
    renderSidebarList();
  });

  state.socket.on('friend-request-declined', ({ requestId }) => {
    state.pendingRequests.sent = state.pendingRequests.sent.filter(r => r._id !== requestId);
    if (state.activeTab === 'requests') renderSidebarList();
  });

  state.socket.on('friend-request-cancelled', ({ requestId }) => {
    state.pendingRequests.received = state.pendingRequests.received.filter(r => r._id !== requestId);
    updateRequestsBadge();
    if (state.activeTab === 'requests') renderSidebarList();
  });

  state.socket.on('receive-message', ({ message }) => {
    const convId = message.conversationId;
    if (convId === state.activeConversationId) {
      state.messages.push(message);
      appendMessage(message);
      scrollToBottom();
      state.socket.emit('mark-read', { conversationId: convId });
    }
    updateConversationLastMsg(message);
    if (state.activeTab === 'chats') renderSidebarList();
  });

  state.socket.on('typing-start', ({ conversationId, userId }) => {
    if (conversationId !== state.activeConversationId) return;
    const user = state.allUsers.find(u => u._id === userId) || state.friends.find(u => u._id === userId);
    const name = user?.name || 'Someone';
    document.getElementById('typing-indicator').classList.remove('hidden');
    document.getElementById('typing-text').textContent = `${name} is typing...`;
    clearTimeout(state.typingTimers[userId]);
    state.typingTimers[userId] = setTimeout(() => {
      document.getElementById('typing-indicator').classList.add('hidden');
    }, 3000);
  });

  state.socket.on('typing-stop', ({ conversationId, userId }) => {
    if (conversationId !== state.activeConversationId) return;
    clearTimeout(state.typingTimers[userId]);
    document.getElementById('typing-indicator').classList.add('hidden');
  });

  state.socket.on('unread-count-update', ({ conversationId, unreadCount }) => {
    const conv = state.conversations.find(c => c._id === conversationId);
    if (conv) { conv.unreadCount = unreadCount; if (state.activeTab === 'chats') renderSidebarList(); }
  });
}

function updateOnlineIndicators(userId, online) {
  document.querySelectorAll(`[data-user-id="${userId}"] .online-dot-indicator`).forEach(el => {
    el.className = `online-dot-indicator w-3 h-3 rounded-full ${online ? 'bg-primary' : 'bg-gray-300'}`;
  });
  if (state.activeConversationId) {
    const conv = state.conversations.find(c => c._id === state.activeConversationId);
    if (conv) {
      const other = conv.participants.find(p => p._id !== state.user.id);
      if (other?._id === userId) {
        const dot = document.getElementById('chat-online-dot');
        const statusText = document.getElementById('chat-status-text');
        if (dot) dot.className = `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-primary-dark ${online ? 'bg-primary' : 'bg-gray-400'}`;
        if (statusText) statusText.textContent = online ? 'Online' : 'Offline';
      }
    }
  }
}

function updateConversationLastMsg(message) {
  const conv = state.conversations.find(c => c._id === message.conversationId);
  if (conv) {
    conv.lastMessage = message;
    if (message.conversationId !== state.activeConversationId) {
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }
    state.conversations.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }
}

// ==================== DATA LOADING ====================
async function loadConversations() {
  try {
    const data = await api.get('/conversations');
    state.conversations = data.conversations || [];
  } catch {}
}

async function loadFriends() {
  try {
    const data = await api.get('/friends');
    state.friends = data.friends || [];
    state.friends.forEach(f => { if (f.isOnline) state.onlineUsers.add(f._id); });
  } catch {}
}

async function loadAllUsers() {
  try {
    const q = state.searchQuery ? `?q=${encodeURIComponent(state.searchQuery)}` : '';
    const data = await api.get(`/users${q}`);
    state.allUsers = data.users || [];
    state.allUsers.forEach(u => { if (u.isOnline) state.onlineUsers.add(u._id); });
  } catch {}
}

async function loadRequests() {
  try {
    const data = await api.get('/friends/requests');
    state.pendingRequests.sent = data.sent || [];
    state.pendingRequests.received = data.received || [];
  } catch {}
}

// ==================== TABS ====================
function setTab(tab) {
  state.activeTab = tab;
  state.searchQuery = '';
  document.getElementById('search-input').value = '';

  const tabs = ['chats', 'people', 'requests', 'profile'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (!el) return;
    const isActive = t === tab;
    el.className = `flex-1 py-3 text-xs font-bold uppercase tracking-wide transition border-b-2 relative ${isActive ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`;
    if (t === 'requests') {
      const badge = document.getElementById('requests-badge');
      if (badge) el.appendChild(badge);
    }
  });

  if (tab === 'profile') {
    showProfileView();
  } else {
    hideProfileView();
  }

  if (tab === 'people') loadAllUsers().then(renderSidebarList);
  else if (tab === 'requests') loadRequests().then(renderSidebarList);
  else renderSidebarList();
}

// ==================== SIDEBAR RENDER ====================
function renderSidebarList() {
  const container = document.getElementById('sidebar-list');
  const tab = state.activeTab;

  if (tab === 'chats') {
    renderChats(container);
  } else if (tab === 'people') {
    renderPeople(container);
  } else if (tab === 'requests') {
    renderRequests(container);
  } else if (tab === 'profile') {
    container.innerHTML = '';
  }
}

function renderChats(container) {
  const q = state.searchQuery.toLowerCase();
  const convs = state.conversations.filter(conv => {
    const other = conv.participants.find(p => p._id !== state.user.id);
    return !q || other?.name.toLowerCase().includes(q);
  });

  if (!convs.length) {
    container.innerHTML = `<div class="p-6 text-center text-gray-400 text-sm"><p class="mb-1">No chats yet</p><p class="text-xs">Add friends to start chatting</p></div>`;
    return;
  }

  container.innerHTML = convs.map(conv => {
    const other = conv.participants.find(p => p._id !== state.user.id);
    if (!other) return '';
    const online = isOnline(other._id);
    const lastMsg = conv.lastMessage;
    const preview = lastMsg ? (lastMsg.content.length > 35 ? lastMsg.content.slice(0, 35) + '...' : lastMsg.content) : 'Say hello!';
    const time = lastMsg ? formatTime(lastMsg.createdAt) : '';
    const unread = conv.unreadCount || 0;
    const isActive = conv._id === state.activeConversationId;
    const src = other.profileImage || defaultAvatar(other.name);

    return `
      <div class="chat-item flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 ${isActive ? 'active' : ''}"
           onclick="openConversation('${conv._id}')" data-user-id="${other._id}">
        <div class="relative flex-shrink-0">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(other.name)}" class="w-12 h-12 rounded-full object-cover bg-gray-200" onerror="this.src='${defaultAvatar(other.name)}'" />
          <span class="online-dot-indicator absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-primary' : 'bg-gray-300'}"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(other.name)}</span>
            <span class="text-xs text-gray-400 flex-shrink-0 ml-2">${time}</span>
          </div>
          <div class="flex items-center justify-between mt-0.5">
            <span class="text-xs text-gray-500 truncate">${escapeHtml(preview)}</span>
            ${unread > 0 ? `<span class="bg-primary text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ml-2 flex-shrink-0 font-bold">${unread}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderPeople(container) {
  const q = state.searchQuery.toLowerCase();
  const users = state.allUsers.filter(u => !q || u.name.toLowerCase().includes(q));

  if (!users.length) {
    container.innerHTML = `<div class="p-6 text-center text-gray-400 text-sm">No users found</div>`;
    return;
  }

  container.innerHTML = users.map(user => {
    const isFriend = state.friends.some(f => f._id === user._id);
    const sentReq = state.pendingRequests.sent.find(r => r.receiver._id === user._id);
    const recvReq = state.pendingRequests.received.find(r => r.sender._id === user._id);
    const online = isOnline(user._id);
    const lastSeen = user.lastSeen ? `Last seen ${formatTime(user.lastSeen)}` : '';
    const src = user.profileImage || defaultAvatar(user.name);

    let actionBtn = '';
    if (isFriend) {
      actionBtn = `<button onclick="openChatWithUser('${user._id}',event)" class="text-xs px-3 py-1.5 bg-primary text-white rounded-full font-semibold hover:bg-primary-dark transition">Chat</button>`;
    } else if (sentReq) {
      actionBtn = `<button onclick="cancelRequest('${sentReq._id}',event)" class="text-xs px-3 py-1.5 bg-gray-200 text-gray-600 rounded-full font-semibold hover:bg-red-100 hover:text-red-600 transition">Cancel</button>`;
    } else if (recvReq) {
      actionBtn = `
        <button onclick="acceptRequest('${recvReq._id}',event)" class="text-xs px-3 py-1.5 bg-primary text-white rounded-full font-semibold hover:bg-primary-dark transition">Accept</button>
        <button onclick="declineRequest('${recvReq._id}',event)" class="text-xs px-3 py-1.5 bg-gray-200 text-gray-600 rounded-full font-semibold hover:bg-red-100 hover:text-red-600 transition ml-1">Decline</button>`;
    } else {
      actionBtn = `<button onclick="sendFriendRequest('${user._id}',event)" class="text-xs px-3 py-1.5 border border-primary text-primary rounded-full font-semibold hover:bg-primary hover:text-white transition">Add Friend</button>`;
    }

    return `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50" data-user-id="${user._id}">
        <div class="relative flex-shrink-0">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(user.name)}" class="w-12 h-12 rounded-full object-cover bg-gray-200" onerror="this.src='${defaultAvatar(user.name)}'" />
          <span class="online-dot-indicator absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-primary' : 'bg-gray-300'}"></span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm text-gray-800">${escapeHtml(user.name)}</p>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(user.statusMessage || '')}</p>
          <p class="text-xs text-gray-400">${online ? '<span class="text-primary font-medium">Online</span>' : escapeHtml(lastSeen)}</p>
        </div>
        <div class="flex-shrink-0">${actionBtn}</div>
      </div>`;
  }).join('');
}

function renderRequests(container) {
  const { sent, received } = state.pendingRequests;

  let html = '';

  if (received.length) {
    html += `<div class="px-4 pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Received (${received.length})</div>`;
    html += received.map(req => {
      const user = req.sender;
      const src = user.profileImage || defaultAvatar(user.name);
      return `
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(user.name)}" class="w-12 h-12 rounded-full object-cover bg-gray-200" onerror="this.src='${defaultAvatar(user.name)}'" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm text-gray-800">${escapeHtml(user.name)}</p>
            <p class="text-xs text-gray-400">${formatTime(req.createdAt)}</p>
          </div>
          <div class="flex gap-1.5">
            <button onclick="acceptRequest('${req._id}')" class="text-xs px-3 py-1.5 bg-primary text-white rounded-full font-semibold hover:bg-primary-dark transition">Accept</button>
            <button onclick="declineRequest('${req._id}')" class="text-xs px-3 py-1.5 bg-gray-200 text-gray-600 rounded-full font-semibold hover:bg-red-100 hover:text-red-600 transition">Decline</button>
          </div>
        </div>`;
    }).join('');
  }

  if (sent.length) {
    html += `<div class="px-4 pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Sent (${sent.length})</div>`;
    html += sent.map(req => {
      const user = req.receiver;
      const src = user.profileImage || defaultAvatar(user.name);
      return `
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(user.name)}" class="w-12 h-12 rounded-full object-cover bg-gray-200" onerror="this.src='${defaultAvatar(user.name)}'" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm text-gray-800">${escapeHtml(user.name)}</p>
            <p class="text-xs text-gray-400">Pending · ${formatTime(req.createdAt)}</p>
          </div>
          <button onclick="cancelRequest('${req._id}')" class="text-xs px-3 py-1.5 bg-gray-200 text-gray-600 rounded-full font-semibold hover:bg-red-100 hover:text-red-600 transition">Cancel</button>
        </div>`;
    }).join('');
  }

  if (!sent.length && !received.length) {
    html = `<div class="p-6 text-center text-gray-400 text-sm"><p class="mb-1">No pending requests</p><p class="text-xs">Go to People to add friends</p></div>`;
  }

  container.innerHTML = html;
}

function updateRequestsBadge() {
  const count = state.pendingRequests.received.length;
  const badge = document.getElementById('requests-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
  badge.classList.toggle('flex', count > 0);
}

// ==================== CHAT ====================
async function openConversation(convId) {
  state.activeConversationId = convId;
  const conv = state.conversations.find(c => c._id === convId);
  if (!conv) return;
  const other = conv.participants.find(p => p._id !== state.user.id);
  if (!other) return;

  conv.unreadCount = 0;
  renderSidebarList();

  const online = isOnline(other._id);
  const src = other.profileImage || defaultAvatar(other.name);
  document.getElementById('chat-avatar').src = src;
  document.getElementById('chat-avatar').onerror = () => { document.getElementById('chat-avatar').src = defaultAvatar(other.name); };
  document.getElementById('chat-name').textContent = other.name;
  document.getElementById('chat-status-text').textContent = online ? 'Online' : (other.lastSeen ? `Last seen ${formatTime(other.lastSeen)}` : 'Offline');
  const dot = document.getElementById('chat-online-dot');
  dot.className = `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-primary-dark ${online ? 'bg-primary' : 'bg-gray-400'}`;

  showChatWindow();
  openMobileChat();

  try {
    const data = await api.get(`/messages/${convId}`);
    state.messages = data.messages || [];
    renderMessages();
    scrollToBottom(true);
    state.socket?.emit('mark-read', { conversationId: convId });
  } catch (err) {
    showToast('Failed to load messages', 'error');
  }
}

async function openChatWithUser(userId, event) {
  if (event) event.stopPropagation();
  try {
    const data = await api.get(`/conversations/with/${userId}`);
    const conv = data.conversation;
    if (!state.conversations.find(c => c._id === conv._id)) {
      state.conversations.unshift({ ...conv, unreadCount: 0 });
    }
    setTab('chats');
    await openConversation(conv._id);
  } catch (err) {
    showToast(err.message || 'Could not open chat', 'error');
  }
}

function renderMessages() {
  const area = document.getElementById('messages-area');
  if (!state.messages.length) {
    area.innerHTML = `<div class="text-center py-8"><p class="text-gray-400 text-sm">No messages yet. Say hello!</p></div>`;
    return;
  }

  let html = '';
  let lastDate = null;

  state.messages.forEach(msg => {
    const d = new Date(msg.createdAt);
    const dateStr = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dateStr !== lastDate) {
      html += `<div class="flex justify-center my-2"><span class="text-xs bg-white/80 text-gray-500 px-3 py-1 rounded-full shadow-sm">${dateStr}</span></div>`;
      lastDate = dateStr;
    }
    html += renderMessage(msg);
  });

  area.innerHTML = html;
  attachMsgContextMenus();
}

function renderMessage(msg) {
  const isSent = msg.sender._id === state.user.id || msg.sender === state.user.id;
  const senderName = isSent ? 'You' : (msg.sender.name || 'Unknown');
  const time = formatMsgTime(msg.createdAt);
  const readByOther = msg.readBy && msg.readBy.length > 1;
  const checkmark = isSent ? (readByOther
    ? `<span class="text-blue-500">✓✓</span>`
    : `<span class="text-gray-400">✓</span>`) : '';

  return `
    <div class="flex ${isSent ? 'justify-end' : 'justify-start'} mb-1 group" data-msg-id="${msg._id}">
      <div class="max-w-[70%] ${isSent ? 'msg-bubble-sent' : 'msg-bubble-recv'} rounded-2xl ${isSent ? 'rounded-br-sm' : 'rounded-bl-sm'} px-3 py-2 shadow-sm relative">
        <p class="text-sm text-gray-800 break-words whitespace-pre-wrap">${escapeHtml(msg.content)}</p>
        <div class="flex items-center justify-end gap-1 mt-1">
          <span class="text-[10px] text-gray-400">${time}</span>
          ${checkmark}
        </div>
        <button class="delete-msg-btn hidden group-hover:flex absolute -top-2 ${isSent ? '-left-2' : '-right-2'} w-5 h-5 bg-gray-500 text-white rounded-full text-xs items-center justify-center hover:bg-red-500 transition"
          onclick="deleteMessage('${msg._id}')" title="Delete for me">×</button>
      </div>
    </div>`;
}

function appendMessage(msg) {
  const area = document.getElementById('messages-area');
  const emptyMsg = area.querySelector('.text-center');
  if (emptyMsg) emptyMsg.remove();
  const div = document.createElement('div');
  div.innerHTML = renderMessage(msg);
  area.appendChild(div.firstElementChild);
  attachMsgContextMenus();
}

function attachMsgContextMenus() {
  document.querySelectorAll('.group').forEach(el => {
    el.onmouseenter = () => el.querySelector('.delete-msg-btn')?.classList.add('flex');
    el.onmouseleave = () => el.querySelector('.delete-msg-btn')?.classList.remove('flex');
  });
}

function scrollToBottom(instant = false) {
  const area = document.getElementById('messages-area');
  if (instant) area.scrollTop = area.scrollHeight;
  else requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

// ==================== SEND MESSAGE ====================
let typingTimer = null;
let isTyping = false;

function handleTyping() {
  if (!state.activeConversationId || !state.socket) return;
  if (!isTyping) {
    isTyping = true;
    state.socket.emit('typing-start', { conversationId: state.activeConversationId });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    state.socket.emit('typing-stop', { conversationId: state.activeConversationId });
  }, 1500);
}

function handleMsgKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !state.activeConversationId) return;

  input.value = '';
  input.style.height = 'auto';

  if (state.socket) {
    state.socket.emit('send-message', { conversationId: state.activeConversationId, content });
    isTyping = false;
    clearTimeout(typingTimer);
    state.socket.emit('typing-stop', { conversationId: state.activeConversationId });
  } else {
    try {
      const data = await api.post('/messages', { conversationId: state.activeConversationId, content });
      state.messages.push(data.message);
      appendMessage(data.message);
      scrollToBottom();
      updateConversationLastMsg(data.message);
      if (state.activeTab === 'chats') renderSidebarList();
    } catch (err) {
      showToast('Failed to send message', 'error');
    }
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 128) + 'px';
}

// ==================== SEARCH ====================
function handleSearch(value) {
  state.searchQuery = value;
  if (state.activeTab === 'people') {
    loadAllUsers().then(renderSidebarList);
  } else {
    renderSidebarList();
  }
}

let msgSearchOpen = false;
function toggleMsgSearch() {
  msgSearchOpen = !msgSearchOpen;
  document.getElementById('msg-search-bar').classList.toggle('hidden', !msgSearchOpen);
  if (msgSearchOpen) document.getElementById('msg-search-input').focus();
  else { searchMessages(''); document.getElementById('msg-search-input').value = ''; }
}

function closeMsgSearch() {
  msgSearchOpen = false;
  document.getElementById('msg-search-bar').classList.add('hidden');
  searchMessages('');
  document.getElementById('msg-search-input').value = '';
}

async function searchMessages(q) {
  if (!state.activeConversationId) return;
  try {
    const url = q ? `/messages/${state.activeConversationId}?q=${encodeURIComponent(q)}` : `/messages/${state.activeConversationId}`;
    const data = await api.get(url);
    state.messages = data.messages || [];
    renderMessages();
    scrollToBottom(true);
  } catch {}
}

// ==================== FRIEND ACTIONS ====================
async function sendFriendRequest(userId, event) {
  if (event) event.stopPropagation();
  try {
    if (state.socket) {
      state.socket.emit('send-friend-request', { toUserId: userId });
      showToast('Friend request sent!', 'success');
    } else {
      const data = await api.post(`/friends/request/${userId}`);
      state.pendingRequests.sent.push(data.request);
      showToast('Friend request sent!', 'success');
    }
    await loadRequests();
    renderSidebarList();
  } catch (err) {
    showToast(err.message || 'Failed to send request', 'error');
  }
}

async function acceptRequest(requestId, event) {
  if (event) event.stopPropagation();
  try {
    if (state.socket) {
      state.socket.emit('accept-friend-request', { requestId });
    }
    await api.put(`/friends/accept/${requestId}`);
    await loadFriends();
    await loadConversations();
    await loadRequests();
    updateRequestsBadge();
    renderSidebarList();
    showToast('Friend request accepted!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to accept', 'error');
  }
}

async function declineRequest(requestId, event) {
  if (event) event.stopPropagation();
  try {
    await api.put(`/friends/decline/${requestId}`);
    await loadRequests();
    updateRequestsBadge();
    renderSidebarList();
  } catch (err) {
    showToast(err.message || 'Failed to decline', 'error');
  }
}

async function cancelRequest(requestId, event) {
  if (event) event.stopPropagation();
  try {
    if (state.socket) {
      state.socket.emit('cancel-friend-request', { requestId });
    }
    await api.delete(`/friends/cancel/${requestId}`);
    await loadRequests();
    renderSidebarList();
    showToast('Request cancelled', 'info');
  } catch (err) {
    showToast(err.message || 'Failed to cancel', 'error');
  }
}

async function deleteMessage(msgId) {
  try {
    await api.delete(`/messages/${msgId}`);
    state.messages = state.messages.filter(m => m._id !== msgId);
    renderMessages();
    scrollToBottom(true);
  } catch (err) {
    showToast('Failed to delete message', 'error');
  }
}

// ==================== PROFILE ====================
function showProfileView() {
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('chat-window').classList.add('hidden');
  document.getElementById('profile-view').classList.remove('hidden');
  const mainArea = document.getElementById('main-area');
  mainArea.classList.remove('hidden');
  mainArea.classList.add('flex');

  const u = state.user;
  if (!u) return;
  const src = u.profileImage || defaultAvatar(u.name);
  document.getElementById('profile-avatar').src = src;
  document.getElementById('profile-image-url').value = u.profileImage || '';
  document.getElementById('profile-name').value = u.name || '';
  document.getElementById('profile-email').value = u.email || '';
  document.getElementById('profile-bio').value = u.bio || '';
  document.getElementById('profile-status').value = u.statusMessage || '';
  document.getElementById('profile-joined').textContent = u.createdAt ? new Date(u.createdAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';

  document.getElementById('profile-image-url').oninput = function() {
    const url = this.value.trim();
    if (url) document.getElementById('profile-avatar').src = url;
    else document.getElementById('profile-avatar').src = defaultAvatar(u.name);
  };
}

function hideProfileView() {
  document.getElementById('profile-view').classList.add('hidden');
  if (!state.activeConversationId) {
    showWelcomeScreen();
  } else {
    showChatWindow();
  }
}

async function saveProfile() {
  try {
    const name = document.getElementById('profile-name').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();
    const statusMessage = document.getElementById('profile-status').value.trim();
    const profileImage = document.getElementById('profile-image-url').value.trim();
    const data = await api.put('/users/profile', { name, bio, statusMessage, profileImage });
    state.user = { ...state.user, ...data.user, id: state.user.id };
    localStorage.setItem('user', JSON.stringify(state.user));
    updateHeaderUser();
    showToast('Profile updated!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to save profile', 'error');
  }
}

async function changePassword() {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  if (!currentPassword || !newPassword) { showToast('Both passwords required', 'error'); return; }
  try {
    await api.put('/users/password', { currentPassword, newPassword });
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    showToast('Password changed successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to change password', 'error');
  }
}

// ==================== EMOJI ====================
const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😢','😡','👍','👎','❤️','🔥','✨','🎉','🙏','💪','👋','🤝','😊','🥳','😴','🤩','😇','🤗','😱','🤭','💯','🎊','🌟','💫','🌈','🍕','🍔','☕','🎵','📱','💻','🏠','🚗','✈️','🌍'];

function initEmojiPicker() {
  const grid = document.querySelector('#emoji-picker .grid');
  if (!grid) return;
  grid.innerHTML = EMOJIS.map(e => `<span class="emoji-btn" onclick="insertEmoji('${e}')">${e}</span>`).join('');
}

let emojiOpen = false;
function toggleEmoji() {
  emojiOpen = !emojiOpen;
  document.getElementById('emoji-picker').classList.toggle('open', emojiOpen);
}

function insertEmoji(emoji) {
  const input = document.getElementById('msg-input');
  input.value += emoji;
  input.focus();
  emojiOpen = false;
  document.getElementById('emoji-picker').classList.remove('open');
}

document.addEventListener('click', (e) => {
  if (emojiOpen && !e.target.closest('#emoji-picker') && !e.target.closest('[onclick="toggleEmoji()"]')) {
    emojiOpen = false;
    document.getElementById('emoji-picker').classList.remove('open');
  }
});

// ==================== UI HELPERS ====================
function showWelcomeScreen() {
  document.getElementById('welcome-screen').classList.remove('hidden');
  document.getElementById('chat-window').classList.add('hidden');
  document.getElementById('profile-view').classList.add('hidden');
  const mainArea = document.getElementById('main-area');
  mainArea.classList.remove('hidden');
  mainArea.classList.add('flex');
}

function showChatWindow() {
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('chat-window').classList.remove('hidden');
  document.getElementById('profile-view').classList.add('hidden');
  const mainArea = document.getElementById('main-area');
  mainArea.classList.remove('hidden');
  mainArea.classList.add('flex');
}

function openMobileChat() {
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.add('mobile-hidden');
    document.getElementById('main-area').classList.add('mobile-open');
  }
}

function closeMobileChat() {
  state.activeConversationId = null;
  document.getElementById('sidebar').classList.remove('mobile-hidden');
  document.getElementById('main-area').classList.remove('mobile-open');
  document.getElementById('main-area').classList.add('hidden');
  document.getElementById('main-area').classList.remove('flex');
  renderSidebarList();
}

function updateHeaderUser() {
  const u = state.user;
  if (!u) return;
  const src = u.profileImage || defaultAvatar(u.name);
  const headerAvatar = document.getElementById('header-avatar');
  headerAvatar.src = src;
  headerAvatar.onerror = () => { headerAvatar.src = defaultAvatar(u.name); };
  document.getElementById('header-name').textContent = u.name || '';
  document.getElementById('header-status').textContent = u.statusMessage || '';
}

function logout() {
  if (state.socket) state.socket.disconnect();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// ==================== INIT ====================
async function init() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return; }

  const stored = localStorage.getItem('user');
  if (stored) {
    state.user = JSON.parse(stored);
    updateHeaderUser();
  }

  try {
    const data = await api.get('/auth/me');
    state.user = { ...data.user, id: data.user._id };
    localStorage.setItem('user', JSON.stringify(state.user));
    updateHeaderUser();
  } catch { window.location.href = '/'; return; }

  initEmojiPicker();
  initSocket();

  await Promise.all([
    loadConversations(),
    loadFriends(),
    loadRequests(),
  ]);

  updateRequestsBadge();
  setTab('chats');
}

init();
