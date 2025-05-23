// Add this at the top with other constants
const SITES = {
  DARAZ: 'daraz',
  AMAZON: 'amazon',
  PAKWHEELS: 'pakwheels',
  OLX: 'olx',
  PriceOye: 'priceoye',
  AliBaba: 'alibaba'
};
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

// Update loadSettings function
async function loadSettings() {
  const settings = await chrome.storage.sync.get([
    'checkInterval', 
    'enabledSites'
  ]);
  
  document.getElementById('checkInterval').value = settings.checkInterval || 15;
  
  // Set site toggles
  const enabledSites = settings.enabledSites || [
    SITES.DARAZ, 
    SITES.AMAZON, 
    SITES.PAKWHEELS,
    SITES.OLX
  ];
  
  document.getElementById('toggleDaraz').checked = enabledSites.includes(SITES.DARAZ);
  document.getElementById('toggleAmazon').checked = enabledSites.includes(SITES.AMAZON);
  document.getElementById('togglePakWheels').checked = enabledSites.includes(SITES.PAKWHEELS);
  document.getElementById('toggleOLX').checked = enabledSites.includes(SITES.OLX);
  document.getElementById('togglePriceOye').checked = enabledSites.includes(SITES.PriceOye);
  document.getElementById('toggleAliBaba').checked = enabledSites.includes(SITES.AliBaba);
}

// Update saveSettings function
async function saveSettings() {
  const interval = parseInt(document.getElementById('checkInterval').value);
  
  const enabledSites = [];
  if (document.getElementById('toggleDaraz').checked) enabledSites.push(SITES.DARAZ);
  if (document.getElementById('toggleAmazon').checked) enabledSites.push(SITES.AMAZON);
  if (document.getElementById('togglePakWheels').checked) enabledSites.push(SITES.PAKWHEELS);
  if (document.getElementById('toggleOLX').checked) enabledSites.push(SITES.OLX);
  if (document.getElementById('togglePriceOye').checked) enabledSites.push(SITES.PriceOye);
  if (document.getElementById('toggleAliBaba').checked) enabledSites.push(SITES.AliBaba);
  
  await chrome.storage.sync.set({ 
    checkInterval: interval,
    enabledSites
  });
  
  chrome.alarms.create('checkPrices', { periodInMinutes: interval });
  
  const status = document.getElementById('status-message');
  status.textContent = 'Settings saved successfully!';
  setTimeout(() => status.textContent = '', 2000);
}

// Update checkAllAlerts to respect enabled sites
async function checkAllAlerts(alerts) {
  const { enabledSites } = await chrome.storage.sync.get(['enabledSites']);
  
  for (const alert of alerts) {
    try {
      // Skip if site is disabled
      if (!enabledSites?.includes(alert.site)) {
        console.log(`Skipping alert for ${alert.site} - site disabled`);
        continue;
      }
      
      const priceData = await getCurrentPrice(alert.url, alert.selector);
      if (!priceData || priceData.numericPrice === null) continue;

      if (priceData.numericPrice <= alert.targetPrice) {
        showNotification(alert, priceData);
        alert.lastChecked = new Date().toISOString();
        await chrome.storage.local.set({ alerts });
      }
    } catch (error) {
      console.error('Error checking alert:', error);
    }
  }
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
    
    const currentPriceDisplay = alert.currentPriceDisplay || 
      `${alert.symbol || 'Rs.'}${alert.currentPrice.toLocaleString('en-US')}`;
    
    const targetPriceDisplay = `Target: ${alert.symbol || 'Rs.'}${alert.targetPrice.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    
    li.innerHTML = `
      <div class="alert-header">
        <h3>${alert.title}</h3>
        <button class="delete-btn" data-url="${alert.url}">Delete</button>
      </div>
      <div class="alert-details">
        ${alert.image ? `<img src="${alert.image}" alt="Product Image">` : ''}
        <div>
          <p class="current-price">${currentPriceDisplay}</p>
          <p class="target-price">${targetPriceDisplay}</p>
          <p class="site-info">${alert.site || 'daraz'}</p>
        </div>
      </div>
    `;
    
    li.addEventListener('click', () => {
      chrome.tabs.create({ url: alert.url, active: true });
    });
    
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
  try {
    // Get current alerts
    const { alerts = [] } = await chrome.storage.local.get('alerts');
    
    // Filter out the alert to delete
    const updatedAlerts = alerts.filter(a => a.url !== url);
    
    // Save back to storage
    await chrome.storage.local.set({ alerts: updatedAlerts });
    
    // Update UI
    loadAlerts();
    
    console.log('Alert deleted successfully:', url);
  } catch (error) {
    console.error('Error deleting alert:', error);
    showToast('Failed to delete alert', true);
  }
}