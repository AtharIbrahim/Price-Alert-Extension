document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings
    chrome.storage.sync.get(['checkInterval'], (data) => {
      document.getElementById('checkInterval').value = data.checkInterval || 15;
    });
  
    // Save settings
    document.getElementById('saveSettings').addEventListener('click', () => {
      const interval = parseInt(document.getElementById('checkInterval').value);
      chrome.storage.sync.set({ checkInterval: interval }, () => {
        // Update alarm
        chrome.alarms.create('checkPrices', { periodInMinutes: interval });
        
        // Show status
        const status = document.getElementById('status');
        status.textContent = 'Settings saved successfully!';
        setTimeout(() => status.textContent = '', 2000);
      });
    });
  });