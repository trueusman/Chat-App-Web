function showToast(message, type = 'success') {
  const existing = document.getElementById('toast-container');
  if (!existing) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
  };
  toast.className = `px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transform translate-x-full transition-all duration-300 ${colors[type] || colors.info}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span class="font-bold">${icons[type] || icons.info}</span><span>${message}</span>`;
  document.getElementById('toast-container').appendChild(toast);
  requestAnimationFrame(() => { toast.classList.remove('translate-x-full'); });
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
