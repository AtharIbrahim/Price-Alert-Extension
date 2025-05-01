
document.addEventListener('DOMContentLoaded', () => {
  // Load alerts initially
  loadAlerts();

  // Settings button click handler
  document.getElementById('settingsButton').addEventListener('click', () => {
    document.getElementById('alerts-view').classList.add('hidden');
    document.getElementById('settings-view').classList.remove('hidden');
    loadSettings();
  });

  // Back button click handler
  document.getElementById('backButton').addEventListener('click', () => {
    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('alerts-view').classList.remove('hidden');
  });

  // Save settings handler
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
});

async function loadSettings() {
  const { checkInterval = 15 } = await chrome.storage.sync.get(['checkInterval']);
  document.getElementById('checkInterval').value = checkInterval;
}

async function saveSettings() {
  const interval = parseInt(document.getElementById('checkInterval').value);
  
  await chrome.storage.sync.set({ checkInterval: interval });
  chrome.alarms.create('checkPrices', { periodInMinutes: interval });
  
  // Show success message
  const status = document.getElementById('status-message');
  status.textContent = 'Settings saved successfully!';
  setTimeout(() => status.textContent = '', 2000);
}

async function loadAlerts() {
  const alerts = await new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_ALERTS' }, resolve);
  });
  
  renderAlerts(alerts);
}

function renderAlerts(alerts) {
  const list = document.getElementById('alerts-list');
  const empty = document.getElementById('empty-state');
  
  list.innerHTML = '';
  
  if (alerts.length === 0) {
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  
  alerts.forEach(alert => {
    const li = document.createElement('li');
    li.className = 'alert-item';
    li.innerHTML = `
      <div class="alert-header">
        <h3>${alert.title}</h3>
        <button class="delete-btn" data-url="${alert.url}">Delete</button>
      </div>
      <div class="alert-details">
        ${alert.image ? `<img src="${alert.image}" alt="Product Image">` : ''}
        <div>
          <p class="current-price">Rs.${alert.currentPrice}</p>
          <p class="target-price">Target: Rs.${alert.targetPrice}</p>
        </div>
      </div>
    `;
    list.appendChild(li);
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.getAttribute('data-url');
      await deleteAlert(url);
    });
  });
}

async function deleteAlert(url) {
  await new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'DELETE_ALERT', url }, resolve);
  });
  loadAlerts();
}


