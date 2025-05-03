// Add this at the top of content.js
const SITES = {
  DARAZ: 'daraz',
  AMAZON: 'amazon',
  PAKWHEELS: 'pakwheels'
};

// Site configurations
const SITE_CONFIGS = {
  daraz: {
    productPagePatterns: [/\/products\//, /\/pd\//],
    priceSelectors: [
      '.pdp-price_size_xl'
    ],
    titleSelector: '.pdp-product-title',
    imageSelector: '.pdp-mod-common-image',
    currency: 'PKR',
    symbol: 'Rs.'
  },
  amazon: {
    productPagePatterns: [/\/dp\//, /\/gp\/product\//],
    priceSelectors: [
      '.priceToPay',
      '.a-price-whole',
      '.a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice'
    ],
    titleSelector: '#productTitle',
    imageSelector: '#landingImage',
    currency: 'USD',
    symbol: '$'
  },
  pakwheels: {
    productPagePatterns: [/\/used-cars\//, /\/new-cars\//],
    priceSelectors: [
      '.price-box .generic-green',
      '.price-amount',
      '.price'
    ],
    titleSelector: '.scroll_car_info h1',
    imageSelector: '.gallery-image img',
    currency: 'PKR',
    symbol: 'Lakh.'
  }
};
// Wait for page to load
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

// Modify the initialize function
async function initialize() {
  // First check if this site is enabled
  const { enabledSites } = await chrome.storage.sync.get(['enabledSites']);
  const hostname = window.location.hostname;
  
  let currentSite;
  if (hostname.includes('daraz')) currentSite = SITES.DARAZ;
  else if (hostname.includes('amazon')) currentSite = SITES.AMAZON;
  else if (hostname.includes('pakwheels')) currentSite = SITES.PAKWHEELS;
  
  if (!enabledSites?.includes(currentSite)) {
    console.log('Price alerts disabled for this site');
    return;
  }

  if (!isProductPage()) return;
  
  const interval = setInterval(() => {
    const priceEl = findPriceElement();
    if (priceEl) {
      clearInterval(interval);
      createSlidingAlertButton();
    }
  }, 500);
}

function getCurrentSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('daraz')) return SITES.DARAZ;
  if (hostname.includes('amazon')) return SITES.AMAZON;
  if (hostname.includes('pakwheels')) return SITES.PAKWHEELS;
  return null;
}

function isProductPage() {
  const siteConfig = getCurrentSiteConfig();
  return siteConfig.productPagePatterns.some(pattern => 
    pattern.test(window.location.pathname)
  ) || siteConfig.priceSelectors.some(selector => 
    document.querySelector(selector)
  );
}

function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('amazon.')) {
    return SITE_CONFIGS.amazon;
  }
  if (hostname.includes('pakwheels.')) {
    return SITE_CONFIGS.pakwheels;
  }
  // Default to Daraz configuration
  return SITE_CONFIGS.daraz;
}

function createSlidingAlertButton() {
  if (document.getElementById('dpa-sliding-btn')) return;
  
  const btn = document.createElement('div');
  btn.id = 'dpa-sliding-btn';
  btn.innerHTML = `
    <div class="dpa-button-container">
      <div class="dpa-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      </div>
      <span class="dpa-button-text">Price Alert</span>
    </div>
  `;
  
  btn.addEventListener('click', handleButtonClick);
  document.body.appendChild(btn);

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #dpa-sliding-btn {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 9999;
      cursor: pointer;
      overflow: hidden;
      border-radius: 25px 0 0 25px;
      // box-shadow: -2px 2px 10px rgba(0,0,0,0.15);
    }
    
    .dpa-button-container {
      display: flex;
      align-items: center;
      background: #f57224;
      padding: 10px 10px 10px 10px;
      transform: translateX(calc(100% - 40px));
      border-radius: 25px 0 0 25px;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    #dpa-sliding-btn:hover .dpa-button-container {
      transform: translateX(0);
    }
    
    .dpa-icon {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 0px;
    }
    
    .dpa-button-text {
      color: white;
      font-weight: 500;
      font-size: 14px;
      margin-left: 10px;
      white-space: nowrap;
      opacity: 0;
      transform: translateX(-10px);
      transition: all 0.3s ease 0.1s;
    }
    
    #dpa-sliding-btn:hover .dpa-button-text {
      opacity: 1;
      transform: translateX(0);
    }
    
    /* Keep your existing toast styles */
    .dpa-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: toastFadeIn 0.3s ease;
    }
    
    .dpa-toast.error {
      background: #f44336;
    }
    
    @keyframes toastFadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

async function handleButtonClick() {
  const { enabledSites } = await chrome.storage.sync.get(['enabledSites']);
  const currentSite = getCurrentSite();
  
  if (!enabledSites?.includes(currentSite)) {
    showToast('Price alerts are disabled for this site', true);
    return;
  }
  const hostname = window.location.hostname; // Add this line
  const priceEl = findPriceElement();
  if (!priceEl) {
    showToast('Could not find product price', true);
    return;
  }

  const siteConfig = getCurrentSiteConfig();
  const rawPriceText = priceEl.textContent.trim();
  const numericPrice = parsePrice(rawPriceText);
  
  if (isNaN(numericPrice)) {
    showToast('Could not parse product price', true);
    return;
  }

  const targetPriceInput = prompt(
    `Enter target price (Current Price: ${rawPriceText}):`, 
    (numericPrice * 0.9).toFixed(2)
  );

  if (!targetPriceInput) return;

  const targetPrice = parsePrice(targetPriceInput);
  if (isNaN(targetPrice)) {
    showToast('Invalid price entered', true);
    return;
  }

  const product = {
    url: window.location.href.split('?')[0],
    title: document.querySelector(siteConfig.titleSelector)?.textContent?.trim() || document.title,
    image: document.querySelector(siteConfig.imageSelector)?.src,
    selector: generateSelector(priceEl),
    currentPrice: numericPrice,
    currentPriceDisplay: rawPriceText,
    targetPrice: targetPrice,
    lastChecked: new Date().toISOString(),
    site: hostname.includes('amazon.') ? 'amazon' : 
          hostname.includes('pakwheels.') ? 'pakwheels' : 'daraz',
    currency: siteConfig.currency,
    symbol: siteConfig.symbol
  };

  chrome.runtime.sendMessage({ type: 'SAVE_ALERT', product }, (response) => {
    showToast(response?.success ? 
      `Alert set for ${product.symbol}${targetPrice}!` :  // Use product.symbol
      'Failed to save alert', !response?.success);
  });
}

function findPriceElement() {
  const siteConfig = getCurrentSiteConfig();
  
  // Try configured selectors first
  for (const selector of siteConfig.priceSelectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  
  // Fallback to generic price detection
  const currencyPattern = siteConfig.currency === 'USD' ? 
    /(\$|USD)\s*[\d,]+/ : 
    /(Rs\.?|PKR)\s*[\d,]+/;
  
  const elements = document.querySelectorAll('*');
  for (let el of elements) {
    if (currencyPattern.test(el.textContent) && el.offsetParent !== null) {
      return el;
    }
  }
  return null;
}

function parsePrice(text) {
  // First remove all non-digit characters except dots and commas
  let cleaned = text.replace(/[^\d.,]/g, '');
  
  // Handle cases where comma is used as decimal separator
  if (cleaned.match(/,\d{2}$/) && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }
  
  // Remove all commas (thousands separators)
  cleaned = cleaned.replace(/,/g, '');
  
  return parseFloat(cleaned);
}
function generateSelector(el) {
  if (el.id) return `#${el.id}`;
  
  const path = [];
  while (el && el !== document.body) {
    let selector = el.tagName.toLowerCase();
    if (el.className) {
      selector += '.' + el.className.split(/\s+/).join('.');
    }
    path.unshift(selector);
    el = el.parentElement;
  }
  return path.join(' > ');
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `dpa-toast ${isError ? 'error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}
