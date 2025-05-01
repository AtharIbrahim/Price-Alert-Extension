// Wait for page to load
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

function initialize() {
  if (!isProductPage()) return;
  
  const interval = setInterval(() => {
    const priceEl = findPriceElement();
    if (priceEl) {
      clearInterval(interval);
      createSlidingAlertButton();
    }
  }, 500);
}

function isProductPage() {
  return /\/products\/|\/pd\//.test(window.location.pathname) || 
         document.querySelector('.pdp-product-price') || 
         document.querySelector('.price-block');
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
  const priceEl = findPriceElement();
  if (!priceEl) {
    showToast('Could not find product price', true);
    return;
  }

  const currentPrice = parsePrice(priceEl.textContent);
  const targetPrice = parseFloat(
    prompt(`Enter target price (Current: Rs.${currentPrice}):`, (currentPrice * 0.9).toFixed(2))
  );

  if (isNaN(targetPrice)) return;

  const product = {
    url: window.location.href.split('?')[0],
    title: document.querySelector('.pdp-product-title')?.textContent?.trim() || document.title,
    image: document.querySelector('.pdp-mod-common-image')?.src,
    selector: generateSelector(priceEl),
    currentPrice: currentPrice,
    targetPrice: targetPrice,
    lastChecked: new Date().toISOString()
  };

  chrome.runtime.sendMessage({ type: 'SAVE_ALERT', product }, (response) => {
    showToast(response?.success ? 
      `Alert set for Rs.${targetPrice}!` : 
      'Failed to save alert', !response?.success);
  });
}

function findPriceElement() {
  const knownSelectors = [
    '.pdp-product-price',
    '.pdp-price',
    '.price-block',
    '.uniform-banner-box-price'
  ];
  
  for (const selector of knownSelectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  
  const elements = document.querySelectorAll('*');
  for (let el of elements) {
    if (/(Rs\.?|PKR)\s*[\d,]+/.test(el.textContent) && 
        el.offsetParent !== null) {
      return el;
    }
  }
  return null;
}

function parsePrice(text) {
  return parseFloat(text.replace(/[^\d.]/g, ''));
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
