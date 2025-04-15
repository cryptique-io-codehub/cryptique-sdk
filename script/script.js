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
      // Update last activity time but preserve other data
      session.lastActivity = now;
      sessionStorage.setItem('cryptique_session', JSON.stringify(session));
      
      // If we have existing pageVisits data, load it
      if (session.sessionData && session.sessionData.pageVisits) {
        sessionData.pageVisits = session.sessionData.pageVisits;
        sessionData.pagesViewed = session.sessionData.pageVisits.length;
      }
      
      return session.id;
    }
  }
  
  // Create a new session ID if none exists or timeout expired
  const newSessionId = generateSessionId();
  
  // Initialize with empty pageVisits array
  sessionStorage.setItem('cryptique_session', JSON.stringify({
    id: newSessionId,
    lastActivity: Date.now(),
    pageViews: 0,
    lastPath: window.location.pathname + window.location.search,
    sessionData: {
      pageVisits: []
    }
  }));
  
  return newSessionId;
}

function trackPageVisit() {
  // Get current path
  const currentPath = window.location.pathname + window.location.search;
  const currentUrl = window.location.href;
  
  // Get current session info
  const storedSession = sessionStorage.getItem('cryptique_session');
  if (!storedSession) {
    // Initialize session storage if missing
    sessionStorage.setItem('cryptique_session', JSON.stringify({
      id: sessionData.sessionId,
      lastActivity: Date.now(),
      pageViews: 0,
      lastPath: currentPath,
      sessionData: {
        pageVisits: []
      }
    }));
  }
  
  let session = JSON.parse(sessionStorage.getItem('cryptique_session'));
  
  // Ensure sessionData exists in the session object
  if (!session.sessionData) {
    session.sessionData = {
      pageVisits: []
    };
  }
  
  // Get existing page visits from session storage
  if (!session.sessionData.pageVisits) {
    session.sessionData.pageVisits = [];
  }
  
  // Check if current page already exists in the session
  const alreadyVisited = session.sessionData.pageVisits.some(
    visit => visit.url === currentUrl
  );
  
  // Only add new page visit if it's not a refresh or duplicate
  if (!alreadyVisited) {
    // Create page visit entry
    const pageVisit = {
      url: currentUrl,
      title: document.title,
      path: currentPath,
      timestamp: new Date().toISOString()
    };
    
    // Add to sessionData pageVisits
    session.sessionData.pageVisits.push(pageVisit);
    
    // Update real page count based on unique URLs
    session.pageViews = session.sessionData.pageVisits.length;
    
    // Update lastPath
    session.lastPath = currentPath;
    
    // Sync with our working sessionData object
    sessionData.pageVisits = session.sessionData.pageVisits;
    sessionData.pagesViewed = session.sessionData.pageVisits.length;
    sessionData.isBounce = sessionData.pagesViewed <= 1;
  }
  
  // Always update activity time
  session.lastActivity = Date.now();
  sessionData.lastActivity = Date.now();
  
  // Save updated session
  sessionStorage.setItem('cryptique_session', JSON.stringify(session));
}

function startSessionTracking() {
  // Initialize session storage if needed
  if (!sessionStorage.getItem('cryptique_session')) {
    const currentPath = window.location.pathname + window.location.search;
    
    sessionStorage.setItem('cryptique_session', JSON.stringify({
      id: sessionData.sessionId,
      lastActivity: Date.now(),
      pageViews: 0,
      lastPath: currentPath,
      sessionData: {
        pageVisits: []
      }
    }));
  }
  
  // Load session data from storage
  const session = JSON.parse(sessionStorage.getItem('cryptique_session'));
  
  // Sync session data with our working object
  if (session.sessionData && session.sessionData.pageVisits) {
    sessionData.pageVisits = session.sessionData.pageVisits;
    sessionData.pagesViewed = session.sessionData.pageVisits.length;
    sessionData.isBounce = sessionData.pagesViewed <= 1;
  }
  
  // Set country
  sessionData.country = countryName;
  
  // Track initial page visit
  trackPageVisit();
  
  // Start the tracking interval
  timer = setInterval(async() => {
    try {
      let chainName = "";
      chainName = await detectChainName();
      
      // Get latest session data
      const currentSession = JSON.parse(sessionStorage.getItem('cryptique_session'));
      if (currentSession && currentSession.sessionData) {
        sessionData.pageVisits = currentSession.sessionData.pageVisits;
        sessionData.pagesViewed = currentSession.sessionData.pageVisits.length;
        sessionData.isBounce = sessionData.pagesViewed <= 1;
      }
      
      // Update timestamps and duration
      const currentTime = new Date();
      sessionData.endTime = currentTime.toISOString();
      sessionData.duration = Math.round(
        (currentTime - new Date(sessionData.startTime)) / 1000
      );
      
      // Update wallet data
      setupWalletTracking();
      sessionData.wallet.chainName = chainName;
      if (userSession.walletAddresses.length > 0) {
        sessionData.wallet.walletAddress = userSession.walletAddresses[0];
      }
      sessionData.wallet.walletType = detectWalletType();
      
      // Update activity time
      sessionData.lastActivity = Date.now();
      
      // Update session storage with latest data
      const updatedSession = {
        id: sessionData.sessionId,
        lastActivity: Date.now(),
        pageViews: sessionData.pagesViewed,
        lastPath: window.location.pathname + window.location.search,
        sessionData: {
          pageVisits: sessionData.pageVisits
        }
      };
      
      sessionStorage.setItem('cryptique_session', JSON.stringify(updatedSession));
      
      // Send data to server
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
    // Get latest session data from storage
    const storedSession = sessionStorage.getItem('cryptique_session');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      
      // Sync page visits and counts from session storage
      if (session.sessionData && session.sessionData.pageVisits) {
        sessionData.pageVisits = session.sessionData.pageVisits;
        sessionData.pagesViewed = session.sessionData.pageVisits.length;
      }
    }
    
    // Update timestamps and duration
    const currentTime = new Date();
    sessionData.endTime = currentTime.toISOString();
    sessionData.duration = Math.round(
      (currentTime - new Date(sessionData.startTime)) / 1000
    );
    sessionData.isBounce = sessionData.pagesViewed <= 1;
    
    // Update wallet info
    if (window.ethereum && userSession.walletAddresses.length > 0) {
      sessionData.wallet.walletAddress = userSession.walletAddresses[0];
      sessionData.wallet.walletType = detectWalletType();
    }
    
    // Send the complete session data
    console.log("Final session data:", sessionData);
    navigator.sendBeacon(API_URL, JSON.stringify({ sessionData }));
    
    // Clear the timer
    clearInterval(timer);
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
