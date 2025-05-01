// Initialize alarms and storage
chrome.runtime.onInstalled.addListener(async () => {
  const { checkInterval } = await chrome.storage.sync.get(['checkInterval']);
  const interval = checkInterval || 15;
  chrome.alarms.create('checkPrices', { periodInMinutes: interval });
  chrome.storage.local.set({ alerts: [] });
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'SAVE_ALERT':
      saveAlert(request.product, sendResponse);
      return true;
    case 'GET_ALERTS':
      getAlerts(sendResponse);
      return true;
    case 'DELETE_ALERT':
      deleteAlert(request.url, sendResponse);
      return true;
  }
});

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkPrices') {
    const { alerts = [] } = await chrome.storage.local.get('alerts');
    if (alerts.length > 0) {
      checkAllAlerts();
    }
  }
});

async function saveAlert(product, sendResponse) {
  try {
    const { alerts = [] } = await chrome.storage.local.get('alerts');
    const existingIndex = alerts.findIndex(a => a.url === product.url);
    
    if (existingIndex >= 0) {
      alerts[existingIndex] = product;
    } else {
      alerts.push(product);
    }
    
    await chrome.storage.local.set({ alerts });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function getAlerts(sendResponse) {
  const { alerts = [] } = await chrome.storage.local.get('alerts');
  sendResponse(alerts);
}

async function deleteAlert(url, sendResponse) {
  const { alerts = [] } = await chrome.storage.local.get('alerts');
  const updated = alerts.filter(a => a.url !== url);
  await chrome.storage.local.set({ alerts: updated });
  sendResponse({ success: true });
}

async function checkAllAlerts() {
  const { alerts = [] } = await chrome.storage.local.get('alerts');
  
  for (const alert of alerts) {
    try {
      const price = await getCurrentPrice(alert.url, alert.selector);
      if (price !== null && price <= alert.targetPrice) {
        showNotification(alert, price);
        // Update last checked time
        alert.lastChecked = new Date().toISOString();
        await chrome.storage.local.set({ alerts });
      }
    } catch (error) {
      console.error('Error checking alert:', error);
    }
  }
}

async function getCurrentPrice(url, selector) {
  return new Promise((resolve) => {
    // Create an invisible tab
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;
      
      // Listen for tab completion
      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          // Execute script to get price
          chrome.scripting.executeScript({
            target: { tabId },
            func: (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const priceText = el.textContent.replace(/[^\d.]/g, '');
              return parseFloat(priceText);
            },
            args: [selector]
          }, ([result]) => {
            // Clean up
            chrome.tabs.remove(tabId);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            resolve(result?.result || null);
          });
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdated);
      
      // Timeout fallback
      setTimeout(() => {
        chrome.tabs.remove(tabId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve(null);
      }, 10000); // 10 second timeout
    });
  });
}

function showNotification(alert, currentPrice) {
  chrome.notifications.create(`alert-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Price Alert Triggered!',
    message: `${alert.title}\n\nCurrent Price: Rs.${currentPrice}\nYour Target: Rs.${alert.targetPrice}`,
    buttons: [{ title: 'View Product' }]
  });

  chrome.notifications.onButtonClicked.addListener(function listener(notificationId) {
    if (notificationId.startsWith('alert-')) {
      chrome.tabs.create({ url: alert.url, active: true });
      chrome.notifications.onButtonClicked.removeListener(listener);
    }
  });
}