const API_URL = "https://cryptique-backend.vercel.app/api/sdk/track";
const VERSION = "v0.11.22";
const CONSENT_STORAGE_KEY = "mtm_consent";
const USER_ID_KEY = "mtm_user_id";
const analyticsScript =
  document.currentScript || document.querySelector('script[src*="script.js"]');
const SITE_ID = analyticsScript.getAttribute("site-id");

function loadWeb3Script(callback) {
  if (typeof Web3 !== "undefined") {
    callback(); // Web3 is already loaded, proceed
    return;
  }

  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/web3/4.4.0/web3.min.js";
  script.type = "text/javascript";
  script.onload = callback; // Run callback after Web3 loads
  document.head.appendChild(script);
}
// 💡 Initialize User Session Object
let userSession = {
  siteId: SITE_ID,
  sessionId: generateSessionId(),
  userId: getOrCreateUserId(),
  sessionStart: Date.now(),
  sessionEnd: null,
  pagesPerVisit: 0,
  isBounce: true,
  userAgent: navigator.userAgent,
  language: navigator.language,
  referrer: getStoredReferrer(),
  resolution: `${window.screen.width}x${window.screen.height}`,
  consentGiven: getTrackingConsent(),
  walletAddresses: [],
  chainId: null,
  provider: null,
  utmData: getUTMParameters(),
  browser: getBrowserAndDeviceInfo().browser,
  os: getBrowserAndDeviceInfo().device.os,
  device: getBrowserAndDeviceInfo().device,

  country: null,
};
//countryName

// 🚀 Utility Functions
function generateSessionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = "usr_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function getTrackingConsent() {
  return localStorage.getItem(CONSENT_STORAGE_KEY) === "true";
}

function setTrackingConsent(consent) {
  localStorage.setItem(CONSENT_STORAGE_KEY, consent ? "true" : "false");
}

function getUTMParameters() {
    const utmParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];
  
    const urlParams = new URLSearchParams(window.location.search);
    let storedUTM = {};
  
    utmParams.forEach(param => {
      const value = urlParams.get(param);
      if (value) {
        storedUTM[param] = value;
      }
    });
  
    return {
      source: storedUTM["utm_source"] || null,
      medium: storedUTM["utm_medium"] || null,
      campaign: storedUTM["utm_campaign"] || null,
      term: storedUTM["utm_term"] || null,
      content: storedUTM["utm_content"] || null,
    };
  }
  

function getStoredReferrer() {
  return localStorage.getItem("referrer") || document.referrer;
}
function getBrowserAndDeviceInfo() {
  const userAgent = navigator.userAgent;
  let deviceType = "desktop";

  if (/Mobi|Android/i.test(userAgent)) {
    deviceType = "mobile";
  } else if (/Tablet|iPad/i.test(userAgent)) {
    deviceType = "tablet";
  }

  return {
    browser: {
      name: navigator.userAgentData?.brands?.[0]?.brand || navigator.appName,
      version: navigator.appVersion,
    },
    device: {
      type: deviceType,
      os: navigator.platform,
      resolution: `${window.screen.width}x${window.screen.height}`,
    },
  };
}

// 🛠️ Activity Tracking Functions
function trackDailyActivity() {
  const today = new Date().toISOString().split("T")[0];
  const lastActive = localStorage.getItem("lastActiveDate");
  if (today !== lastActive) {
    localStorage.setItem("lastActiveDate", today);
    return true;
  }
  return false;
}

function trackWeeklyActivity() {
  const currentWeek = getWeekNumber(new Date());
  const lastWeek = localStorage.getItem("lastActiveWeek");
  if (currentWeek !== lastWeek) {
    localStorage.setItem("lastActiveWeek", currentWeek);
    return true;
  }
  return false;
}

function trackMonthlyActivity() {
  const currentMonth = new Date().getMonth();
  const lastMonth = localStorage.getItem("lastActiveMonth");
  if (currentMonth !== lastMonth) {
    localStorage.setItem("lastActiveMonth", currentMonth);
    return true;
  }
  return false;
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

// 📈 Page View and Event Tracking
function trackPageView() {
  // Get current session data from storage
  const storedSession = sessionStorage.getItem('cryptique_session');
  let pageViews = 1;
  
  if (storedSession) {
    const session = JSON.parse(storedSession);
    // Update page views
    pageViews = (session.pageViews || 0) + 1;
    session.pageViews = pageViews;
    session.lastActivity = Date.now();
    sessionStorage.setItem('cryptique_session', JSON.stringify(session));
  }
  
  // Update userSession page count
  userSession.pagesPerVisit = pageViews;
  userSession.isBounce = pageViews <= 1;

  trackEvent("PAGEVIEW", {
    pageUrl: window.location.href,
    pageTitle: document.title,
    userActivity: {
      dau: trackDailyActivity(),
      wau: trackWeeklyActivity(),
      mau: trackMonthlyActivity(),
    },
  });
}
let sessionData = {
  sessionId: getOrCreateSessionId(),
  siteId: SITE_ID,
  userId: userSession.userId,
  referrer: document.referrer || "direct",
  utmData: getUTMParameters(),
  pagePath: window.location.pathname,
  startTime: new Date().toISOString(),
  wallet:{
    walletAddress: "",
    walletType: "",
    chainName: "",
      },
  endTime: null,
  pagesViewed: 0,
  duration: 0,
  isBounce: true,
  country: "",
  device: getBrowserAndDeviceInfo().device,
  browser: getBrowserAndDeviceInfo().browser,
  pageVisits: [],
  lastActivity: Date.now()
};
let timer;
let countryName;
function getCountryName() {
  fetch("https://ipinfo.io/14.139.196.236?token=05d7fac5c0c506")
    .then((res) => res.json())
    .then((data) => {
      countryName = data.country;
      sessionData.country = countryName;
    })
    .catch((err) => console.error("Error:", err));
  return countryName;
}
function getOrCreateSessionId() {
  const storedSession = sessionStorage.getItem('cryptique_session');
  if (storedSession) {
    const session = JSON.parse(storedSession);
    const now = Date.now();
    // If last activity was less than 120 seconds ago, reuse the same session
    if (now - session.lastActivity < 120000) {
      session.lastActivity = now;
      sessionStorage.setItem('cryptique_session', JSON.stringify(session));
      return session.id;
    }
  }
  
  // Create a new session ID if none exists or timeout expired
  const newSessionId = generateSessionId();
  sessionStorage.setItem('cryptique_session', JSON.stringify({
    id: newSessionId,
    lastActivity: Date.now(),
    pageViews: 0
  }));
  return newSessionId;
}

function trackPageVisit() {
  // Get current session info
  const storedSession = sessionStorage.getItem('cryptique_session');
  let session = storedSession ? JSON.parse(storedSession) : null;
  
  // Get current path
  const currentPath = window.location.pathname + window.location.search;
  
  if (session) {
    // Store last visited path to check for duplicate page views
    const lastPath = session.lastPath || '';
    
    // Only increment page views if this is a different page than the last one visited
    if (lastPath !== currentPath) {
      // Increment page views counter in session storage
      session.pageViews = (session.pageViews || 0) + 1;
      session.lastPath = currentPath;
    }
    
    sessionStorage.setItem('cryptique_session', JSON.stringify(session));
    
    // Update the session data object with current page view count
    sessionData.pagesViewed = session.pageViews;
    sessionData.isBounce = session.pageViews <= 1;
  }
  
  // Only add a page visit entry if it's a new page
  const pageVisits = sessionData.pageVisits || [];
  const currentUrl = window.location.href;
  
  // Check if we already recorded this page
  const alreadyVisited = pageVisits.some(visit => visit.url === currentUrl);
  
  if (!alreadyVisited) {
    const pageVisit = {
      url: currentUrl,
      title: document.title,
      path: currentPath,
      timestamp: new Date().toISOString()
    };
    
    if (!sessionData.pageVisits) {
      sessionData.pageVisits = [];
    }
    
    sessionData.pageVisits.push(pageVisit);
  }
  
  // Always update last activity time
  sessionData.lastActivity = Date.now();
  sessionStorage.setItem('cryptique_session', JSON.stringify({
    id: sessionData.sessionId,
    lastActivity: sessionData.lastActivity,
    pageViews: sessionData.pagesViewed,
    lastPath: currentPath
  }));
}

function startSessionTracking() {
  // Check for existing session data
  const storedSession = sessionStorage.getItem('cryptique_session');
  if (storedSession) {
    const session = JSON.parse(storedSession);
    
    // If we have page view data from a previous visit, use it
    if (session.pageViews) {
      sessionData.pagesViewed = session.pageViews;
      sessionData.isBounce = session.pageViews <= 1;
    } else {
      sessionData.pagesViewed = 1;
      
      // Initialize pageViews in session storage
      session.pageViews = 1;
      session.lastPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('cryptique_session', JSON.stringify(session));
    }
  } else {
    // First page view of a new session
    sessionData.pagesViewed = 1;
    
    // Initialize session storage with first page view
    sessionStorage.setItem('cryptique_session', JSON.stringify({
      id: sessionData.sessionId,
      lastActivity: Date.now(),
      pageViews: 1,
      lastPath: window.location.pathname + window.location.search
    }));
  }
  
  sessionData.country = countryName;
  // Track this page visit
  trackPageVisit();
  
  timer = setInterval(async() => {
    try {
      let chainName = "";
      chainName = await detectChainName();
      const currentTime = new Date();
      sessionData.endTime = currentTime.toISOString();
      sessionData.duration = Math.round(
        (currentTime - new Date(sessionData.startTime)) / 1000
      );
      setupWalletTracking();
      sessionData.wallet.chainName = chainName;
      if (userSession.walletAddresses.length > 0) {
        sessionData.wallet.walletAddress = userSession.walletAddresses[0];
      }
      sessionData.wallet.walletType = detectWalletType();
      // Update last activity time
      sessionData.lastActivity = Date.now();
      
      // Get latest session data from storage
      const storedSession = sessionStorage.getItem('cryptique_session');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        // Make sure we're using the most up-to-date page view count
        if (session.pageViews) {
          sessionData.pagesViewed = session.pageViews;
          sessionData.isBounce = session.pageViews <= 1;
        }
      }
      
      sessionStorage.setItem('cryptique_session', JSON.stringify({
        id: sessionData.sessionId,
        lastActivity: sessionData.lastActivity,
        pageViews: sessionData.pagesViewed,
        lastPath: window.location.pathname + window.location.search
      }));
      
      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionData }),
      })
        .then((res) => res.json())
        .then(res => console.log('Session sent:', res))
        .catch((err) => console.error("Error:", err));
    } catch (error) {
      console.error("Error in session tracking interval:", error);
    }
  }, 5000); // Send data every 5 seconds
}
window.addEventListener("beforeunload", () => {
  try {
    // Get latest page view count from session storage
    const storedSession = sessionStorage.getItem('cryptique_session');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      if (session.pageViews) {
        sessionData.pagesViewed = session.pageViews;
      }
    }
    
    const currentTime = new Date();
    sessionData.endTime = currentTime.toISOString();
    sessionData.duration = Math.round(
      (currentTime - new Date(sessionData.startTime)) / 1000
    );
    sessionData.isBounce = sessionData.pagesViewed <= 1;
    
    // Ensure we have the latest wallet data
    if (window.ethereum && userSession.walletAddresses.length > 0) {
      sessionData.wallet.walletAddress = userSession.walletAddresses[0];
      sessionData.wallet.walletType = detectWalletType();
    }
    
    // Send the final session data
    navigator.sendBeacon(API_URL, JSON.stringify({ sessionData }));
    clearInterval(timer); // Stop the timer
  } catch (error) {
    console.error("Error in beforeunload handler:", error);
  }
});
function setupWalletTracking() {
  if (window.ethereum) {
    window.ethereum
      .request({ method: "eth_requestAccounts" })
      .then((accounts) => {
        if (accounts.length > 0) {
          userSession.walletAddresses = accounts;
        }
      });
  }
}
function detectWallets() {
  let detectedWallets = []; // Array to store detected wallet names.
  if (window.ethereum) {
    // Check for specific wallet properties to identify them.
    if (window.ethereum.isMetaMask) {
      detectedWallets.push("MetaMask");
    }
    if (window.ethereum.isTrustWallet) {
      detectedWallets.push("Trust Wallet");
    }
    if (window.ethereum.isCoinbaseWallet) {
      detectedWallets.push("Coinbase Wallet");
    }
    if (window.ethereum.isBraveWallet) {
      detectedWallets.push("Brave Wallet");
    }
    if (window.ethereum.isFrame) {
      detectedWallets.push("Frame");
    }
    if (window.ethereum.isPhantom) {
      detectedWallets.push("Phantom");
    }
    if (window.ethereum.isTronLink) {
      detectedWallets.push("TronLink");
    }
    //return a boolean value if the wallet is detected
    return detectedWallets.length > 0;
  }
}
function detectWalletType() {
  if (window.ethereum) {
    if (window.ethereum.isMetaMask) {
      return "MetaMask";
    } else if (window.ethereum.isTrustWallet) {
      return "Trust Wallet";
    } else if (window.ethereum.isCoinbaseWallet) {
      return "Coinbase Wallet";
    } else if (window.ethereum.isBraveWallet) {
      return "Brave Wallet";
    } else if (window.ethereum.isFrame) {
      return "Frame";
    } else if (window.ethereum.isPhantom) {
      return "Phantom";
    } else if (window.ethereum.isTronLink) {
      return "TronLink";
    } else {
      return "Unknown Wallet";
    }
  } else {
    return "No Wallet Detected";
  }
}
function detectChainId() {
  if (window.ethereum) {
    return window.ethereum.chainId;
  } else {
    return "No Wallet Detected";
  }
}
async function detectEthereumProvider() {
  if (window.ethereum) {
    // Modern Web3 wallets.
    return window.ethereum;
  } else if (window.web3) {
    // Legacy Web3 wallets.
    return window.web3.currentProvider;
  } else {
    // No provider found.
    return null;
  }
}
async function detectChainName() {
  try {
    const provider = await detectEthereumProvider();
    if (!provider) {
      return "No Wallet Detected";
    }

    // Request access to the user's accounts.
    await provider.request({ method: "eth_requestAccounts" });

    // Ensure Web3 is available
    if (typeof Web3 === "undefined") {
      return "Web3 is not defined";
    }

    // Initialize Web3 with the provider.
    const web3 = new Web3(provider);

    // Get the connected accounts.
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      return "No accounts found";
    }

    // Get the network ID (chain ID).
    const networkId = await web3.eth.net.getId();
    let chainName = "Unknown";

    // Map network IDs to chain names.
    switch (networkId) {
      case 1:
        chainName = "Ethereum Mainnet";
        break;
      case 56:
        chainName = "Binance Smart Chain";
        break;
      case 137:
        chainName = "Polygon";
        break;
      case 10:
        chainName = "Optimism";
        break;
      case 42161:
        chainName = "Arbitrum One";
        break;
      case 250:
        chainName = "Fantom Opera";
        break;
      case 43114:
        chainName = "Avalanche";
        break;
      case 100:
        chainName = "xDai";
        break;
      case 1313161554:
        chainName = "Aurora";
        break;
      default:
        chainName = `Unknown (ID: ${networkId})`;
    }

    return chainName;
  } catch (error) {
    console.error("Error detecting chain name:", error);
    return "Error";
  }
}

function trackEvent(eventType, eventData = {}) {
  userSession.country = getCountryName();
  
  // Get latest session info from storage
  const storedSession = sessionStorage.getItem('cryptique_session');
  if (storedSession) {
    const session = JSON.parse(storedSession);
    
    // Update last activity time
    session.lastActivity = Date.now();
    
    // If we have page view data, use it
    if (typeof session.pageViews !== 'undefined') {
      sessionData.pagesViewed = session.pageViews;
      sessionData.isBounce = session.pageViews <= 1;
    }
    
    sessionStorage.setItem('cryptique_session', JSON.stringify(session));
  }
  
  const payload = {
    siteId: SITE_ID,
    websiteUrl: window.location.href,
    userId: userSession.userId,
    sessionId: sessionData.sessionId,
    type: eventType,
    pagePath: window.location.pathname,
    isWeb3User: detectWallets(),

    eventData: {
      ...eventData,
      ...userSession.utmData,
      referrer: userSession.referrer,
      sessionDuration: Date.now() - userSession.sessionStart,
      pagesPerVisit: sessionData.pagesViewed || userSession.pagesPerVisit,
      isBounce: sessionData.pagesViewed <= 1,
      browser: userSession.browser,
      os: userSession.os,
      deviceType: userSession.deviceType,
      resolution: userSession.resolution,
      language: userSession.language,
      country: userSession.country,
      pageVisits: sessionData.pageVisits
    },
    timestamp: new Date().toISOString(),
    version: VERSION,
  };
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, sessionData }),
  })
    .then((res) => res.json())
    .then((result) => console.log("API Response:", result))
    .catch((error) => console.error("Error:", error));
}

// 🚀 Initialization
function initCryptiqueAnalytics() {
    setupWalletTracking();
    getCountryName();
    startSessionTracking();
  trackPageView();
}

// Start Analytics
loadWeb3Script(() => {
  initCryptiqueAnalytics();
});

// Updated for Vercel deployment - timestamp: 2023-07-19
