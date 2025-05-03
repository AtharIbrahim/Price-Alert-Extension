// Site configurations
const SITE_CONFIGS = {
  daraz: {
    currency: 'PKR',
    symbol: 'Rs.'
  },
  amazon: {
    currency: 'USD',
    symbol: '$'
  },
  pakwheels: {
    currency: 'PKR',
    symbol: 'Lakh.'
  }
};

// Initialize alarms and storage
chrome.runtime.onInstalled.addListener(async () => {
  const { checkInterval } = await chrome.storage.sync.get(['checkInterval']);
  const interval = checkInterval || 15;
  chrome.alarms.create('checkPrices', { periodInMinutes: interval });
  chrome.storage.local.set({ alerts: [] });
});

// Handle Messages
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
      checkAllAlerts(alerts);
    }
  }
});

// Save Alert in Extension
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

// Get Alert in Extension
async function getAlerts(sendResponse) {
  const { alerts = [] } = await chrome.storage.local.get('alerts');
  sendResponse(alerts);
}

// Delete Alert
async function deleteAlert(url, sendResponse) {
  const { alerts = [] } = await chrome.storage.local.get('alerts');
  const updated = alerts.filter(a => a.url !== url);
  await chrome.storage.local.set({ alerts: updated });
  sendResponse({ success: true });
}

// Check the current price of product
async function getCurrentPrice(url, selector) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;
      
      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.scripting.executeScript({
            target: { tabId },
            func: (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              
              const rawText = el.textContent.trim();
              let numericValue;
              
              // Special handling for Daraz prices (e.g., "Rs. 1,234" or "1,234 Rs.")
              if (window.location.hostname.includes('daraz')) {
                // Find the first sequence of numbers with commas/decimals
                const priceMatch = rawText.match(/(\d{1,3}(,\d{3})*(\.\d+)?)/);
                if (priceMatch) {
                  numericValue = parseFloat(priceMatch[0].replace(/,/g, ''));
                } else {
                  // Fallback to basic parsing if regex fails
                  numericValue = parseFloat(rawText.replace(/[^\d.]/g, ''));
                }
              } else {
                // Standard parsing for other sites
                numericValue = parseFloat(rawText.replace(/[^\d.]/g, '').replace(/,/g, ''));
              }
              
              if (isNaN(numericValue)) {
                console.error('Failed to parse price:', rawText);
                return null;
              }
              
              console.log('Price parsed:', {
                site: window.location.hostname,
                rawText,
                numericValue,
                selector
              });
              
              return {
                rawText,
                numericPrice: numericValue
              };
            },
            args: [selector]
          }, ([result]) => {
            chrome.tabs.remove(tabId);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            resolve(result?.result || null);
          });
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdated);
      
      setTimeout(() => {
        chrome.tabs.remove(tabId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve(null);
      }, 10000);
    });
  });
}

// Check Alert in form of list
async function checkAllAlerts(alerts) {
  for (const alert of alerts) {
    try {
      const priceData = await getCurrentPrice(alert.url, alert.selector);
      if (!priceData || priceData.numericPrice === null) {
        console.log('Skipping alert - could not get current price');
        continue;
      }

      const currentPrice = priceData.numericPrice;
      const targetPrice = alert.targetPrice;

      console.log(`Checking alert: ${alert.title}`, {
        currentPrice,
        targetPrice,
        comparison: currentPrice <= targetPrice
      });

      if (currentPrice <= targetPrice) {
        console.log('Price alert triggered - condition met');
        showNotification(alert, priceData);
        alert.lastChecked = new Date().toISOString();
        await chrome.storage.local.set({ alerts });
      } else {
        console.log('Price alert not triggered - current price above target');
      }
    } catch (error) {
      console.error('Error checking alert:', error);
    }
  }
}

// Show notification to user
function showNotification(alert, priceData) {
  const siteConfig = SITE_CONFIGS[alert.site || 'daraz'] || SITE_CONFIGS.daraz;
  
  // Format prices with proper thousands separators
  const formatPrice = (price) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const currentPriceDisplay = priceData?.rawText || 
    `${siteConfig.symbol}${formatPrice(priceData?.numericPrice)}`;
  
  const targetPriceDisplay = `${siteConfig.symbol}${formatPrice(alert.targetPrice)}`;
  
  chrome.notifications.create(`alert-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon.png',
    title: 'Price Alert Triggered!',
    message: `${alert.title}\n\nCurrent Price: ${currentPriceDisplay}\nYour Target: ${targetPriceDisplay}`,
    buttons: [{ title: 'View Product' }],
    priority: 2
  });

  const notificationClickListener = (notificationId) => {
    if (notificationId.startsWith('alert-')) {
      chrome.tabs.create({ url: alert.url, active: true });
      chrome.notifications.onButtonClicked.removeListener(notificationClickListener);
    }
  };
  
  chrome.notifications.onButtonClicked.addListener(notificationClickListener);
}