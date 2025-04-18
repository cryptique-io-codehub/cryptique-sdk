const API_URL = "https://cryptique-backend.vercel.app/api/sdk/track";
const VERSION = "v0.11.22";
const CONSENT_STORAGE_KEY = "mtm_consent";
const USER_ID_KEY = "mtm_user_id";
const analyticsScript =
  document.currentScript || document.querySelector('script[src*="script.js"]');
const SITE_ID = analyticsScript.getAttribute("site-id");

// Initialize variables needed for session tracking
let timer;
let countryName;

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
  const urlParams = new URLSearchParams(window.location.search);
  return {
    source: urlParams.get('utm_source') || '',
    medium: urlParams.get('utm_medium') || '',
    campaign: urlParams.get('utm_campaign') || '',
    term: urlParams.get('utm_term') || '',
    content: urlParams.get('utm_content') || '',
    utm_id: urlParams.get('utm_id') || ''  // Added utm_id parameter
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

// Initialize user session data
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
  utmData: getUTMParameters(),  // This will now include utm_id
  browser: getBrowserAndDeviceInfo().browser,
  os: getBrowserAndDeviceInfo().device.os,
  device: getBrowserAndDeviceInfo().device,
  country: null,
};

// Pre-initialize sessionData with a temporary ID
let sessionData = {
  sessionId: generateSessionId(),
  siteId: SITE_ID,
  userId: userSession.userId,
  referrer: "direct",
  utmData: getUTMParameters(),  // This will now include utm_id
  pagePath: window.location.pathname,
  startTime: new Date().toISOString(),
  wallet: {
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
  lastActivity: Date.now(),
  isFirstPage: true
};

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

// Function to get the proper referrer, prioritizing UTM data
function getProperReferrer() {
  const utmData = getUTMParameters();
  
  // If UTM source exists, use it as the primary source
  if (utmData.source) {
    return document.referrer || "direct"; // Still store the actual referrer
  }
  
  // If no UTM, use the referrer or "direct"
  return document.referrer || "direct";
}

function getOrCreateSessionId() {
  try {
    const storedSession = sessionStorage.getItem('cryptique_session');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      const now = Date.now();
      // If last activity was less than 120 seconds ago, reuse the same session
      if (now - session.lastActivity < 120000) {
        // Update last activity time but preserve other data
        session.lastActivity = now;
        sessionStorage.setItem('cryptique_session', JSON.stringify(session));
        
        // If we have existing session data, load it
        if (session.sessionData) {
          // Copy all the data except current page-specific data
          if (session.sessionData.pageVisits) {
            sessionData.pageVisits = session.sessionData.pageVisits;
            sessionData.pagesViewed = session.sessionData.pageVisits.length;
          }
          
          // Keep the original startTime from the first page
          if (session.sessionData.startTime) {
            sessionData.startTime = session.sessionData.startTime;
          }
          
          // Keep the original referrer from the first page
          if (session.sessionData.referrer) {
            sessionData.referrer = session.sessionData.referrer;
          }
          
          // Keep the original UTM data from the first page
          if (session.sessionData.utmData) {
            sessionData.utmData = session.sessionData.utmData;
          }
          
          // Mark that this is not the first page in the session
          sessionData.isFirstPage = false;
        }
        
        return session.id;
      }
    }
    
    // Create a new session ID if none exists or timeout expired
    const newSessionId = generateSessionId();
    
    // For a new session, set the correct referrer
    sessionData.referrer = getProperReferrer();
    sessionData.isFirstPage = true;
    
    // Initialize with empty pageVisits array
    sessionStorage.setItem('cryptique_session', JSON.stringify({
      id: newSessionId,
      lastActivity: Date.now(),
      pageViews: 0,
      lastPath: window.location.pathname + window.location.search,
      sessionData: {
        pageVisits: [],
        startTime: sessionData.startTime,
        referrer: sessionData.referrer,
        utmData: sessionData.utmData
      }
    }));
    
    return newSessionId;
  } catch (error) {
    console.error("Error in getOrCreateSessionId:", error);
    return generateSessionId(); // Fallback
  }
}

// Update sessionData with the proper session ID
// This needs to be called after all the necessary functions are defined
function initializeSessionData() {
  try {
    sessionData.sessionId = getOrCreateSessionId();
  } catch (error) {
    console.error("Error initializing session data:", error);
  }
}

// Call this immediately after definition
initializeSessionData();

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

function trackPageVisit() {
  try {
    // Get current path
    const currentPath = window.location.pathname + window.location.search;
    const currentUrl = window.location.href;
    
    // Get current session info
    const storedSession = sessionStorage.getItem('cryptique_session');
    if (!storedSession) {
      // Initialize session storage if missing
      const initialSessionData = {
        id: sessionData.sessionId,
        lastActivity: Date.now(),
        pageViews: 0,
        lastPath: currentPath,
        sessionData: {
          pageVisits: [],
          startTime: sessionData.startTime,
          referrer: sessionData.referrer,
          utmData: sessionData.utmData
        }
      };
      sessionStorage.setItem('cryptique_session', JSON.stringify(initialSessionData));
    }
    
    let session = JSON.parse(sessionStorage.getItem('cryptique_session'));
    
    // Ensure sessionData exists in the session object
    if (!session.sessionData) {
      session.sessionData = {
        pageVisits: [],
        startTime: sessionData.startTime,
        referrer: sessionData.referrer,
        utmData: sessionData.utmData
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
      
      // Calculate current duration
      const currentTime = new Date();
      const startTime = new Date(sessionData.startTime);
      const currentDuration = Math.round((currentTime - startTime) / 1000);
      
      // Update bounce status based on EITHER duration >= 30 seconds OR more than 1 page view
      sessionData.isBounce = currentDuration < 30 && sessionData.pagesViewed <= 1;
    }
    
    // Always update activity time
    session.lastActivity = Date.now();
    sessionData.lastActivity = Date.now();
    
    // Save updated session - make sure to preserve the original startTime and referrer
    if (!session.sessionData.startTime) {
      session.sessionData.startTime = sessionData.startTime;
    }
    
    if (!session.sessionData.referrer) {
      session.sessionData.referrer = sessionData.referrer;
    }
    
    sessionStorage.setItem('cryptique_session', JSON.stringify(session));
  } catch (error) {
    console.error("Error in trackPageVisit:", error);
  }
}

function startSessionTracking() {
  try {
    // Initialize session storage if needed
    if (!sessionStorage.getItem('cryptique_session')) {
      const currentPath = window.location.pathname + window.location.search;
      
      // For a new session, set the correct referrer
      sessionData.referrer = getProperReferrer();
      sessionData.isFirstPage = true;
      
      sessionStorage.setItem('cryptique_session', JSON.stringify({
        id: sessionData.sessionId,
        lastActivity: Date.now(),
        pageViews: 0,
        lastPath: currentPath,
        sessionData: {
          pageVisits: [],
          startTime: sessionData.startTime,
          referrer: sessionData.referrer,
          utmData: sessionData.utmData
        }
      }));
    }
    
    // Load session data from storage
    const sessionStr = sessionStorage.getItem('cryptique_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      
      // Sync session data with our working object
      if (session.sessionData) {
        // Keep original startTime from first page
        if (session.sessionData.startTime) {
          sessionData.startTime = session.sessionData.startTime;
        }
        
        // Keep original referrer from first page
        if (session.sessionData.referrer) {
          sessionData.referrer = session.sessionData.referrer;
        }
        
        // Keep the original UTM data from the first page
        if (session.sessionData.utmData) {
          sessionData.utmData = session.sessionData.utmData;
        }
        
        if (session.sessionData.pageVisits) {
          sessionData.pageVisits = session.sessionData.pageVisits;
          sessionData.pagesViewed = session.sessionData.pageVisits.length;
          sessionData.isBounce = sessionData.pagesViewed <= 1;
          sessionData.isFirstPage = sessionData.pageVisits.length === 0;
        }
      }
    }
    
    // Set country
    sessionData.country = countryName;
    
    // Track initial page visit
    trackPageVisit();
    
    // Start the tracking interval
    timer = setInterval(async() => {
      try {
        let chainName = "";
        try {
          chainName = await detectChainName();
        } catch (chainError) {
          console.error("Error detecting chain name:", chainError);
          chainName = "Error";
        }
        
        // Get latest session data
        const sessionStr = sessionStorage.getItem('cryptique_session');
        if (sessionStr) {
          const currentSession = JSON.parse(sessionStr);
          if (currentSession && currentSession.sessionData) {
            // Keep original startTime from first page
            if (currentSession.sessionData.startTime) {
              sessionData.startTime = currentSession.sessionData.startTime;
            }
            
            // Keep original referrer from first page
            if (currentSession.sessionData.referrer) {
              sessionData.referrer = currentSession.sessionData.referrer;
            }
            
            // Keep the original UTM data
            if (currentSession.sessionData.utmData) {
              sessionData.utmData = currentSession.sessionData.utmData;
            }
            
            // Update page count data
            if (currentSession.sessionData.pageVisits) {
              sessionData.pageVisits = currentSession.sessionData.pageVisits;
              sessionData.pagesViewed = currentSession.sessionData.pageVisits.length;
              sessionData.isBounce = sessionData.pagesViewed <= 1;
            }
          }
        }
        
        // Update timestamps and duration - only endTime, not startTime
        const currentTime = new Date();
        sessionData.endTime = currentTime.toISOString();
        sessionData.duration = Math.round(
          (currentTime - new Date(sessionData.startTime)) / 1000
        );
        
        // Update wallet data
        try {
          setupWalletTracking();
        } catch (walletError) {
          console.error("Error setting up wallet tracking:", walletError);
        }
        
        sessionData.wallet.chainName = chainName;
        if (userSession.walletAddresses && userSession.walletAddresses.length > 0) {
          sessionData.wallet.walletAddress = userSession.walletAddresses[0];
        }
        
        try {
          sessionData.wallet.walletType = detectWalletType();
        } catch (walletTypeError) {
          console.error("Error detecting wallet type:", walletTypeError);
          sessionData.wallet.walletType = "Unknown";
        }
        
        // Update activity time
        sessionData.lastActivity = Date.now();
        
        // Update session storage with latest data - preserve original startTime and referrer
        const updatedSession = {
          id: sessionData.sessionId,
          lastActivity: Date.now(),
          pageViews: sessionData.pagesViewed,
          lastPath: window.location.pathname + window.location.search,
          sessionData: {
            pageVisits: sessionData.pageVisits,
            startTime: sessionData.startTime,
            referrer: sessionData.referrer,
            utmData: sessionData.utmData
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
  } catch (error) {
    console.error("Error in startSessionTracking:", error);
  }
}

// Add additional error handling and initialization before main execution
window.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("Cryptique SDK initializing...");
    
    // Make sure all required objects exist
    if (!window.sessionStorage) {
      console.error("SessionStorage is not available in this browser");
    }
    
    // Ensure our sessionId is properly initialized
    if (!sessionData || !sessionData.sessionId) {
      console.log("Reinitializing session data...");
      if (!sessionData) {
        sessionData = {
          sessionId: generateSessionId(),
          siteId: SITE_ID,
          userId: getOrCreateUserId(),
          startTime: new Date().toISOString()
        };
      } else if (!sessionData.sessionId) {
        sessionData.sessionId = generateSessionId();
      }
    }
  } catch (error) {
    console.error("Error during SDK initialization:", error);
  }
});

// Update beforeunload event handler with better error handling
window.addEventListener("beforeunload", () => {
  try {
    console.log("Sending final session data...");
    
    // Make sure we have a valid sessionData object
    if (!sessionData) {
      console.error("Session data is undefined");
      return;
    }
    
    // Get latest session data from storage
    const storedSession = sessionStorage.getItem('cryptique_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        
        // Sync page visits and counts from session storage
        if (session.sessionData) {
          // Keep the original startTime from the first page
          if (session.sessionData.startTime) {
            sessionData.startTime = session.sessionData.startTime;
          }
          
          // Keep the original referrer from the first page
          if (session.sessionData.referrer) {
            sessionData.referrer = session.sessionData.referrer;
          }
          
          // Keep the original UTM data
          if (session.sessionData.utmData) {
            sessionData.utmData = session.sessionData.utmData;
          }
          
          if (session.sessionData.pageVisits) {
            sessionData.pageVisits = session.sessionData.pageVisits;
            sessionData.pagesViewed = session.sessionData.pageVisits.length;
          }
        }
      } catch (parseError) {
        console.error("Error parsing stored session:", parseError);
      }
    }
    
    // Update endTime and duration - leave startTime unchanged
    const currentTime = new Date();
    sessionData.endTime = currentTime.toISOString();
    
    // Calculate duration from original startTime to now
    try {
      const startTimeDate = new Date(sessionData.startTime);
      sessionData.duration = Math.round(
        (currentTime - startTimeDate) / 1000
      );
    } catch (durationError) {
      console.error("Error calculating duration:", durationError);
      sessionData.duration = 0;
    }
    
    // Set bounce flag based on EITHER duration >= 30 seconds OR more than 1 page view
    sessionData.isBounce = sessionData.duration < 30 && sessionData.pagesViewed <= 1;
    
    // Update wallet info if available
    if (window.ethereum && userSession && userSession.walletAddresses && userSession.walletAddresses.length > 0) {
      sessionData.wallet = sessionData.wallet || {};
      sessionData.wallet.walletAddress = userSession.walletAddresses[0];
      
      try {
        sessionData.wallet.walletType = detectWalletType();
      } catch (walletError) {
        console.error("Error detecting wallet type:", walletError);
        sessionData.wallet.walletType = "Unknown";
      }
    }
    
    // Send the complete session data only if navigator.sendBeacon is available
    if (navigator.sendBeacon) {
      try {
        console.log("Final session data:", sessionData);
        navigator.sendBeacon(API_URL, JSON.stringify({ sessionData }));
      } catch (beaconError) {
        console.error("Error sending beacon:", beaconError);
      }
    } else {
      console.warn("sendBeacon not supported, using fetch instead");
      fetch(API_URL, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionData })
      }).catch(e => console.error("Error sending final data:", e));
    }
    
    // Clear the timer if it exists
    if (typeof timer !== 'undefined') {
      clearInterval(timer);
    }
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
