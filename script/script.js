// Check if script is already loaded to prevent duplicate initialization when using GTM
if (window.CryptiqueSDK) {
  console.log('Cryptique SDK already initialized, skipping duplicate load');
} else {
  // Create global namespace for SDK
  window.CryptiqueSDK = { initialized: true };

  const API_URL = "https://cryptique-backend.vercel.app/api/sdk/track";
  const VERSION = "v0.11.23";
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
    walletConnected: false,  // Add explicit wallet connection status
    walletAddresses: [],
    chainId: null,
    provider: null,
    utmData: getUTMParameters(),
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
    utmData: getUTMParameters(),
    pagePath: window.location.pathname,
    startTime: new Date().toISOString(),
    wallet: {
      walletAddress: "",
      walletType: "",
      chainName: "",
    },
    isWeb3User: false,
    walletConnected: false,  // Add explicit wallet connection status
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
    // Set a default value in case of failure
    let countryName = "";
    
    // Add a timeout option to the fetch call
    const fetchOptions = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Accept': 'application/json'
      },
      // Force HTTP/1.1 by disabling HTTP/2 and HTTP/3
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    };
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Geolocation request timed out')), 3000);
    });
    
    // First try the primary call with a timeout
    Promise.race([
      fetch("https://ipinfo.io/json?token=05d7fac5c0c506", fetchOptions),
      timeoutPromise
    ])
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.country) {
          countryName = data.country;
          sessionData.country = countryName;
        }
      })
      .catch((err) => {
        console.error("Primary geolocation error:", err);
        
        // Fall back to a different method - explicitly use HTTP/1.1
        const backupUrl = "https://ipinfo.io/json?token=05d7fac5c0c506&http=1.1";
        
        fetch(backupUrl, fetchOptions)
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error: ${res.status}`);
            }
            return res.json();
          })
          .then((data) => {
            if (data && data.country) {
              countryName = data.country;
              sessionData.country = countryName;
            }
          })
          .catch((backupErr) => {
            console.error("Backup geolocation error:", backupErr);
            // Set a fallback value
            sessionData.country = "Unknown";
          });
      });
    
    return countryName || "Unknown";
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
      // Always ensure we have the correct user ID before any session operations
      const persistentUserId = getOrCreateUserId();
      
      const storedSession = sessionStorage.getItem('cryptique_session');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        const now = Date.now();
        // If last activity was less than 120 seconds ago, reuse the same session
        if (now - session.lastActivity < 120000) {
          // Update last activity time but preserve other data
          session.lastActivity = now;
          
          // CRITICAL FIX: Ensure the userId is always consistent
          // This ensures that UTM parameters don't cause user ID changes
          if (!session.userId || session.userId !== persistentUserId) {
            session.userId = persistentUserId;
          }
          
          sessionStorage.setItem('cryptique_session', JSON.stringify(session));
          
          // If we have existing session data, load it
          if (session.sessionData) {
            // Copy all the data except current page-specific data
            if (session.sessionData.pageVisits) {
              sessionData.pageVisits = session.sessionData.pageVisits;
              sessionData.pagesViewed = session.sessionData.pageVisits.length;
            }
            
            // CRITICAL FIX: Ensure the user ID is consistent here too
            sessionData.userId = persistentUserId;
            
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
      
      // CRITICAL FIX: Always ensure userId is set from localStorage, not regenerated
      sessionData.userId = persistentUserId;
      
      // Initialize with empty pageVisits array
      sessionStorage.setItem('cryptique_session', JSON.stringify({
        id: newSessionId,
        userId: persistentUserId, // CRITICAL FIX: Store userId in session
        lastActivity: Date.now(),
        pageViews: 0,
        lastPath: window.location.pathname + window.location.search,
        sessionData: {
          pageVisits: [],
          startTime: sessionData.startTime,
          referrer: sessionData.referrer,
          utmData: sessionData.utmData,
          userId: persistentUserId // CRITICAL FIX: Also store in sessionData
        }
      }));
      
      return newSessionId;
    } catch (error) {
      console.error("Error in getOrCreateSessionId:", error);
      // CRITICAL FIX: Even on error, ensure we have a valid userId
      sessionData.userId = getOrCreateUserId();
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
      // Get current path and URL information
      const currentPath = window.location.pathname + window.location.search;
      const currentUrl = window.location.href;
      const currentTimestamp = new Date().toISOString();
      
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
        // Create page visit entry in the format expected by the backend
        const pageVisit = {
          url: currentUrl,
          title: document.title,
          path: currentPath,
          timestamp: currentTimestamp,
          duration: 0, // Will be updated later
          isEntry: session.sessionData.pageVisits.length === 0,
          isExit: true // Mark as exit until another page is viewed
        };
        
        // If this isn't the first page, update the previous page's isExit and calculate duration
        if (session.sessionData.pageVisits.length > 0) {
          const previousPage = session.sessionData.pageVisits[session.sessionData.pageVisits.length - 1];
          previousPage.isExit = false;
          
          // Calculate duration of previous page if possible
          if (previousPage.timestamp) {
            const prevTimestamp = new Date(previousPage.timestamp);
            const currentTime = new Date(currentTimestamp);
            previousPage.duration = Math.floor((currentTime - prevTimestamp) / 1000);
          }
        }
        
        // Add to sessionData pageVisits
        session.sessionData.pageVisits.push(pageVisit);
        
        // Update real page count based on unique URLs
        session.pageViews = session.sessionData.pageVisits.length;
        
        // Update lastPath
        session.lastPath = currentPath;
        
        // Sync with our working sessionData object
        sessionData.pageVisits = session.sessionData.pageVisits;
        sessionData.pagesViewed = session.sessionData.pageVisits.length;
        
        // Format visitedPages array for backend
        sessionData.visitedPages = session.sessionData.pageVisits.map((visit, index) => ({
          path: visit.path || visit.url,
          timestamp: new Date(visit.timestamp),
          duration: visit.duration || 0,
          isEntry: visit.isEntry || (index === 0),
          isExit: visit.isExit || (index === session.sessionData.pageVisits.length - 1)
        }));
        
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
      // CRITICAL FIX: Always ensure we have the correct user ID before any operations
      const persistentUserId = getOrCreateUserId();
      sessionData.userId = persistentUserId; 
      userSession.userId = persistentUserId;
      
      // Initialize session storage if needed
      if (!sessionStorage.getItem('cryptique_session')) {
        const currentPath = window.location.pathname + window.location.search;
        
        // For a new session, set the correct referrer
        sessionData.referrer = getProperReferrer();
        sessionData.isFirstPage = true;
        
        sessionStorage.setItem('cryptique_session', JSON.stringify({
          id: sessionData.sessionId,
          userId: persistentUserId, // CRITICAL FIX: Store userId in session
          lastActivity: Date.now(),
          pageViews: 0,
          lastPath: currentPath,
          sessionData: {
            pageVisits: [],
            startTime: sessionData.startTime,
            referrer: sessionData.referrer,
            utmData: sessionData.utmData,
            userId: persistentUserId // CRITICAL FIX: Also store in sessionData
          }
        }));
      }
      
      // Load session data from storage
      const sessionStr = sessionStorage.getItem('cryptique_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        
        // CRITICAL FIX: Always ensure userId is consistent
        if (!session.userId || session.userId !== persistentUserId) {
          session.userId = persistentUserId;
          sessionStorage.setItem('cryptique_session', JSON.stringify(session));
        }
        
        // Sync session data with our working object
        if (session.sessionData) {
          // CRITICAL FIX: Always ensure userId is consistent in sessionData
          sessionData.userId = persistentUserId;
          
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
            // Calculate current duration
            const currentTime = new Date();
            const startTime = new Date(sessionData.startTime);
            const currentDuration = Math.round((currentTime - startTime) / 1000);
            // Update bounce status based on EITHER duration >= 30 seconds OR more than 1 page view
            sessionData.isBounce = currentDuration < 30 && sessionData.pagesViewed <= 1;
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
                // Calculate current duration
                const currentTime = new Date();
                const startTime = new Date(sessionData.startTime);
                const currentDuration = Math.round((currentTime - startTime) / 1000);
                // Update bounce status based on EITHER duration >= 30 seconds OR more than 1 page view
                sessionData.isBounce = currentDuration < 30 && sessionData.pagesViewed <= 1;
              }
            }
          }
          
          // Update timestamps and duration - only endTime, not startTime
          const currentTime = new Date();
          sessionData.endTime = currentTime.toISOString();
          sessionData.duration = Math.round(
            (currentTime - new Date(sessionData.startTime)) / 1000
          );
          
          // Update bounce status based on current duration
          sessionData.isBounce = sessionData.duration < 30 && sessionData.pagesViewed <= 1;
          
          // Update wallet data
          try {
            await updateWalletInfo();
            // Use the values already set by updateWalletInfo() instead of doing separate checks
            sessionData.wallet.chainName = sessionData.wallet.chainName;
            if (userSession.walletAddresses && userSession.walletAddresses.length > 0) {
              sessionData.wallet.walletAddress = userSession.walletAddresses[0];
            }
            // We already set walletType in updateWalletInfo()
          } catch (walletError) {
            console.error("Error setting up wallet tracking:", walletError);
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
          
          // Ensure visitedPages array is properly formatted for backend
          if (sessionData.pageVisits && Array.isArray(sessionData.pageVisits)) {
            // Format the visitedPages array in the expected format for the backend
            sessionData.visitedPages = sessionData.pageVisits.map((visit, index) => ({
              path: visit.path || visit.url,
              timestamp: new Date(visit.timestamp),
              duration: visit.duration || 60, // Default duration if not available
              isEntry: index === 0,
              isExit: index === sessionData.pageVisits.length - 1
            }));
            
            // Make sure pagesViewed count matches visitedPages length
            sessionData.pagesViewed = sessionData.visitedPages.length;
          } else if (!sessionData.visitedPages) {
            // Initialize visitedPages as empty array if missing
            sessionData.visitedPages = [];
          }
          
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
  window.addEventListener("beforeunload", (event) => {
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
              
              // Format visitedPages array for backend
              sessionData.visitedPages = session.sessionData.pageVisits.map((visit, index) => ({
                path: visit.path || visit.url,
                timestamp: new Date(visit.timestamp),
                duration: visit.duration || 0,
                isEntry: visit.isEntry || (index === 0),
                isExit: visit.isExit || (index === session.sessionData.pageVisits.length - 1)
              }));
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
      
      // Prepare a minimal data version for fallback
      const minimalSessionData = {
        sessionId: sessionData.sessionId,
        siteId: sessionData.siteId,
        userId: sessionData.userId,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        duration: sessionData.duration,
        pagesViewed: sessionData.pagesViewed,
        isBounce: sessionData.isBounce,
        country: sessionData.country || "Unknown"
      };
      
      // Try multiple methods of sending data, with progressively simpler data
      // First attempt: Use sendBeacon with full data
      let beaconSuccess = false;
      if (navigator.sendBeacon) {
        try {
          console.log("Using sendBeacon with full data");
          beaconSuccess = navigator.sendBeacon(API_URL, JSON.stringify({ sessionData }));
          if (!beaconSuccess) {
            console.warn("sendBeacon failed, will try alternatives");
          }
        } catch (beaconError) {
          console.error("Error sending beacon:", beaconError);
        }
      }
      
      // Second attempt: Use fetch with keepalive if sendBeacon failed or isn't available
      if (!beaconSuccess) {
        try {
          console.log("Using fetch with keepalive");
          // Don't wait for the promise - it will execute in the background with keepalive
          fetch(API_URL, {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionData })
          });
        } catch (fetchError) {
          console.error("Error with fetch:", fetchError);
          
          // Third attempt: Try with minimal data as a last resort
          try {
            fetch(API_URL, {
              method: "POST",
              keepalive: true,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionData: minimalSessionData })
            });
          } catch (minimalFetchError) {
            console.error("All data sending methods failed:", minimalFetchError);
          }
        }
      }
      
      // Store the session data in localStorage as a last-resort backup
      // that can be sent on next page load if everything else fails
      try {
        localStorage.setItem('cryptique_last_session', JSON.stringify(sessionData));
      } catch (storageError) {
        console.error("Failed to store session backup:", storageError);
      }
      
      // Clear the timer if it exists
      if (typeof timer !== 'undefined') {
        clearInterval(timer);
      }
    } catch (error) {
      console.error("Error in beforeunload handler:", error);
    }
  });

  // Detect all available wallet providers
  function detectWalletProviders() {
    const providers = [];
    
    // Check for multiple injected providers
    if (window.ethereum?.providers) {
      // Multi-injected providers case (e.g., user has multiple wallets installed)
      return window.ethereum.providers;
    } else if (window.ethereum) {
      // Single injected provider
      return [window.ethereum];
    }
    
    // Check for specific wallet providers
    if (window.trustWallet) providers.push(window.trustWallet);
    if (window.coinbaseWalletExtension) providers.push(window.coinbaseWalletExtension);
    if (window.phantom?.ethereum) providers.push(window.phantom.ethereum);
    
    return providers;
  }

  // Check if wallet is already connected (silent check)
  async function checkWalletConnected() {
    const providers = detectWalletProviders();
    if (providers.length === 0) return false;
    
    try {
      // Check all providers for existing connections
      for (const provider of providers) {
        try {
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            return true;
          }
        } catch (e) {
          console.debug('Error checking provider:', e);
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      return false;
    }
  }

  // Show wallet selection UI
  function showWalletSelector() {
    return new Promise((resolve, reject) => {
      const providers = detectWalletProviders();
      if (providers.length === 0) {
        return reject(new Error('No Ethereum wallets detected. Please install a wallet like MetaMask.'));
      }
      
      if (providers.length === 1) {
        return resolve(providers[0]);
      }

      // Create modal for wallet selection
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        max-height: 90vh;
        overflow-y: auto;
      `;

      const title = document.createElement('h2');
      title.textContent = 'Select a Wallet';
      title.style.marginTop = '0';
      title.style.color = '#333';

      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
      `;
      closeButton.onclick = () => {
        document.body.removeChild(modal);
        reject(new Error('User cancelled wallet selection'));
      };

      const walletList = document.createElement('div');
      walletList.style.margin = '1.5rem 0';

      // Wallet data with names and icons
      const walletInfo = {
        'MetaMask': { icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
        'Trust Wallet': { icon: 'https://cryptologos.cc/logos/trust-wallet-token-twt-logo.png' },
        'Coinbase Wallet': { icon: 'https://cryptologos.cc/logos/coinbase-wallet-cwallet-logo.png' },
        'Phantom': { icon: 'https://cryptologos.cc/logos/phantom-protocol-phantom-logo.png' },
        'default': { icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' }
      };

      // Create wallet buttons
      providers.forEach((provider, index) => {
        const walletName = provider.isMetaMask ? 'MetaMask' :
                         provider.isTrust ? 'Trust Wallet' :
                         provider.isCoinbaseWallet ? 'Coinbase Wallet' :
                         provider.isPhantom ? 'Phantom' :
                         `Wallet ${index + 1}`;
        
        const wallet = walletInfo[walletName] || walletInfo.default;
        
        const button = document.createElement('button');
        button.style.cssText = `
          display: flex;
          align-items: center;
          width: 100%;
          padding: 1rem;
          margin-bottom: 0.75rem;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        `;
        button.onmouseover = () => button.style.borderColor = '#666';
        button.onmouseout = () => button.style.borderColor = '#e0e0e0';
        
        const img = document.createElement('img');
        img.src = wallet.icon;
        img.width = 32;
        img.height = 32;
        img.style.marginRight = '1rem';
        
        const name = document.createElement('span');
        name.textContent = walletName;
        name.style.fontSize = '1rem';
        
        button.appendChild(img);
        button.appendChild(name);
        
        button.onclick = async () => {
          button.style.background = '#f0f0f0';
          document.body.removeChild(modal);
          resolve(provider);
        };
        
        walletList.appendChild(button);
      });

      modalContent.appendChild(closeButton);
      modalContent.appendChild(title);
      modalContent.appendChild(walletList);
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
    });
  }

  // Connect wallet (to be called on user action)
  async function connectWallet() {
    try {
      // Show wallet selector and get the chosen provider
      const provider = await showWalletSelector();
      if (!provider) {
        throw new Error('No wallet provider selected');
      }

      // Set the selected provider as the active one
      if (window.ethereum && window.ethereum !== provider) {
        window.ethereum = provider;
      }

      // Request account access
      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length > 0) {
        // Update wallet info after successful connection
        await updateWalletInfo();
        return accounts[0];
      }
      return null;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  }

  function setupWalletTracking() {
    if (window.ethereum) {
      // Initial silent check for connected accounts
      checkWalletConnected().then(isConnected => {
        if (isConnected) {
          updateWalletInfo();
        }
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          updateWalletInfo();
        } else {
          // Wallet disconnected
          sessionData.wallet = {
            walletAddress: "No Wallet Connected",
            walletType: detectWalletType(),
            chainName: "Not Connected"
          };
          sessionData.walletConnected = false;
          userSession.walletConnected = false;
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', () => {
        updateWalletInfo();
      });
    }
  }
  function detectWallets() {
    let detectedWallets = []; // Array to store detected wallet names.
    
    // First check if ethereum object exists in the window
    if (window.ethereum) {
      // Try to get accounts without prompting the user
      try {
        // Use a synchronous check first just to populate detectedWallets
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
        
        // If any specific wallet wasn't detected but ethereum object exists,
        // add a generic "Web3 Wallet" entry
        if (detectedWallets.length === 0) {
          detectedWallets.push("Web3 Wallet");
        }
        
        // Key change: Don't just return true if wallets are detected
        // Instead, check if we have user accounts to determine if the wallet is actually connected
        // This is the async part that will be resolved in updateWalletInfo
        // Here we're just returning if we have detected wallets, but not making claims about connection state
        return detectedWallets.length > 0;
      } catch (error) {
        console.error("Error in detectWallets:", error);
        return false;
      }
    }
    // No ethereum object means no wallet
    return false;
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
    }
    return "No Wallet Detected";
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

      // First try to get chainId directly from provider if available
      // This works even if the user hasn't connected their wallet
      if (provider.chainId) {
        const networkId = parseInt(provider.chainId, 16);
        return getChainNameFromId(networkId);
      }

      // Ensure Web3 is available
      if (typeof Web3 === "undefined") {
        return "Web3 is not defined";
      }

      // Initialize Web3 with the provider.
      const web3 = new Web3(provider);

      // Try to get accounts without prompting
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) {
        // We have a wallet but no connected accounts
        // Try to get the network ID directly without needing accounts
        try {
          const networkId = await web3.eth.net.getId();
          return getChainNameFromId(networkId);
        } catch (netIdError) {
          // If we can't get network ID, try to get chainId from provider
          if (provider.chainId) {
            const networkId = parseInt(provider.chainId, 16);
            return getChainNameFromId(networkId);
          }
          return "Not Connected";
        }
      }

      // If we have accounts, get the network ID
      const networkId = await web3.eth.net.getId();
      return getChainNameFromId(networkId);
    } catch (error) {
      console.error("Error detecting chain name:", error);
      return "Error";
    }
  }

  // Helper function to get chain name from network ID
  function getChainNameFromId(networkId) {
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
  }

  function trackEvent(eventType, eventData = {}) {
    // Don't call getCountryName() synchronously here as it won't have results immediately
    // Instead use the current value in sessionData, which will be populated asynchronously
    
    // Get latest session info from storage
    const storedSession = sessionStorage.getItem('cryptique_session');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      
      // Update last activity time
      session.lastActivity = Date.now();
      
      // If we have page view data, use it
      if (typeof session.pageViews !== 'undefined') {
        sessionData.pagesViewed = session.pageViews;
        // Calculate current duration
        const currentTime = new Date();
        const startTime = new Date(sessionData.startTime);
        const currentDuration = Math.round((currentTime - startTime) / 1000);
        // Update bounce status based on EITHER duration >= 30 seconds OR more than 1 page view
        sessionData.isBounce = currentDuration < 30 && sessionData.pagesViewed <= 1;
      }
      
      sessionStorage.setItem('cryptique_session', JSON.stringify(session));
    }
    
    // Update wallet info without resetting isWeb3User - call our full update function
    // which properly handles all wallet detection cases
    try {
      updateWalletInfo();
    } catch (walletError) {
      console.error("Error updating wallet info in trackEvent:", walletError);
    }
    
    const payload = {
      siteId: SITE_ID,
      websiteUrl: window.location.href,
      userId: userSession.userId,
      sessionId: sessionData.sessionId,
      type: eventType,
      pagePath: window.location.pathname,
      isWeb3User: sessionData.isWeb3User,
      walletConnected: sessionData.walletConnected,  // Add wallet connection status

      eventData: {
        ...eventData,
        ...userSession.utmData,
        referrer: userSession.referrer,
        sessionDuration: Date.now() - userSession.sessionStart,
        pagesPerVisit: sessionData.pagesViewed || userSession.pagesPerVisit,
        isBounce: sessionData.isBounce,
        browser: userSession.browser,
        os: userSession.os,
        deviceType: userSession.deviceType,
        resolution: userSession.resolution,
        language: userSession.language,
        country: sessionData.country || userSession.country || "Unknown",
        pageVisits: sessionData.pageVisits,
        walletConnected: sessionData.walletConnected  // Add to event data as well
      },
      timestamp: new Date().toISOString(),
      version: VERSION,
    };
    
    // Use fetch with explicit CORS mode and reliability options
    const fetchOptions = {
      method: "POST",
      mode: "cors",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ payload, sessionData }),
      // Additional reliability options
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      keepalive: true // Keep the request alive even if page unloads
    };
    
    // Create a timeout promise for the tracking endpoint
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tracking request timed out')), 5000);
    });
    
    // Race the fetch against a timeout
    Promise.race([
      fetch(API_URL, fetchOptions),
      timeoutPromise
    ])
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
      })
      .then((result) => console.log("API Response:", result))
      .catch((error) => {
        console.error("Error tracking event:", error);
        
        // Fallback to a simpler version or retry with different options if needed
        if (error.message.includes('timed out')) {
          // Try one more time with a simpler payload
          const simplifiedPayload = {
            siteId: SITE_ID,
            userId: userSession.userId,
            sessionId: sessionData.sessionId,
            type: eventType,
            pagePath: window.location.pathname,
            timestamp: new Date().toISOString(),
            version: VERSION
          };
          
          // Simple retry with minimal data
          fetch(API_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: simplifiedPayload }),
            keepalive: true
          }).catch(retryErr => console.error("Retry also failed:", retryErr));
        }
      });
  }

  // Track clicks on interactive elements
  function startClickTracking() {
    document.body.addEventListener('click', function(event) {
      // Find the closest interactive element
      const element = event.target.closest('a, button, [role="button"], [data-cryptique-id]');
      
      if (element) {
        // Create element data object with relevant properties
        const elementData = {
          tagName: element.tagName.toLowerCase(),
          id: element.id || '',
          className: element.className || '',
          innerText: (element.innerText || '').substring(0, 100), // Limit text length
          href: element.tagName.toLowerCase() === 'a' ? element.href : '',
          dataId: element.getAttribute('data-cryptique-id') || ''
        };
        
        // Track the click event
        trackEvent('ELEMENT_CLICK', elementData);
      }
    });
    
    console.log('Cryptique click tracking initialized');
  }

  // 🚀 Initialization
  function initCryptiqueAnalytics() {
    // Check for any unsent session data from previous page loads
    try {
      const lastSession = localStorage.getItem('cryptique_last_session');
      if (lastSession) {
        const lastSessionData = JSON.parse(lastSession);
        console.log("Found unsent session data from previous visit, sending now...");
        
        // Send the stored session data
        fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionData: lastSessionData })
        })
        .then(() => {
          // Clear the stored session data only if the send was successful
          localStorage.removeItem('cryptique_last_session');
          console.log("Successfully sent previous session data");
        })
        .catch(e => console.error("Error sending previous session data:", e));
      }
    } catch (error) {
      console.error("Error checking for previous session data:", error);
    }
    
    // First try to get geolocation data - do this before anything else
    // This gives the async call time to complete
    getCountryName();
    
    // Setup wallet tracking
    setupWalletTracking();
    
    // Start session tracking
    startSessionTracking();
    
    // Start click tracking
    startClickTracking();
    
    // Track initial page view (after a small delay to allow geolocation)
    setTimeout(() => {
      trackPageView();
    }, 500);
  }

  // Initialize wallet connect button
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWalletConnectButton);
  } else {
    setupWalletConnectButton();
  }

  // Start Analytics as soon as possible
  try {
    // Start geolocation immediately to give it time
    getCountryName();
    
    // Load Web3 script if needed
    loadWeb3Script(() => {
      initCryptiqueAnalytics();
    });
  } catch (error) {
    console.error("Error initializing analytics:", error);
    
    // Fallback initialization without Web3
    try {
      getCountryName();
      startSessionTracking();
      setTimeout(() => trackPageView(), 500);
    } catch (fallbackError) {
      console.error("Fallback initialization also failed:", fallbackError);
    }
  }

  // Updated for Vercel deployment - timestamp: 2023-07-19

  async function updateWalletInfo() {
    try {
      const walletType = detectWalletType();
      let chainName = "Not Connected";
      let walletAddress = "";
      let isConnected = false;

      if (window.ethereum) {
        try {
          // Only check for existing accounts, don't prompt
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          
          // If accounts exist, the wallet is connected
          if (accounts && accounts.length > 0) {
            walletAddress = accounts[0];
            isConnected = true;
            
            // Only try to get chain information if we have a connected account
            try {
              chainName = await detectChainName();
            } catch (chainError) {
              console.log("Error getting chain name:", chainError);
              chainName = "Unknown Chain";
            }
          } else {
            // Wallet exists but not connected
            walletAddress = "";
            chainName = "Not Connected";
            isConnected = false;
          }
        } catch (accountError) {
          console.log("Error getting accounts:", accountError);
          walletAddress = "";
          chainName = "Error";
          isConnected = false;
        }
      }

      // Update session wallet data
      sessionData.wallet = {
        walletAddress: walletAddress || "No Wallet Connected",
        walletType: walletType || "No Wallet Detected",
        chainName: chainName || "No Chain Detected"
      };

      // Update wallet connection status - only true if we have a valid wallet address
      sessionData.walletConnected = isConnected;
      userSession.walletConnected = isConnected;

      // List of actual wallet types that indicate a web3 user even if not connected
      const validWalletTypes = [
        "MetaMask", 
        "Trust Wallet", 
        "Coinbase Wallet", 
        "Brave Wallet", 
        "Frame", 
        "Phantom", 
        "TronLink", 
        "Web3 Wallet"
      ];

      // Set isWeb3User based on wallet detection OR connection
      // A user is considered a Web3 user if any of these criteria are met:
      // 1. They have a connected wallet with a valid address
      // 2. They have a recognized wallet type installed, even if not connected
      // 3. They have interacted with the ethereum object in a way that confirms web3 usage
      sessionData.isWeb3User = isConnected || 
                             (walletAddress && walletAddress.trim() !== "" && walletAddress !== "No Wallet Connected") ||
                             (chainName && chainName !== "Not Connected" && chainName !== "No Chain Detected" && chainName !== "Error") ||
                             (validWalletTypes.includes(walletType));

      // Log the result for debugging
      console.log("Wallet Status:", {
        walletAddress,
        walletType,
        chainName,
        isWalletConnected: sessionData.walletConnected,
        isWeb3User: sessionData.isWeb3User
      });

    } catch (error) {
      console.error("Error updating wallet info:", error);
      sessionData.wallet = {
        walletAddress: "No Wallet Detected",
        walletType: "No Wallet Detected",
        chainName: "No Wallet Detected"
      };
      sessionData.isWeb3User = false;
      sessionData.walletConnected = false;
      userSession.walletConnected = false;
    }
  }

  // Handle wallet connection for a single button element
  function setupWalletButton(button) {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await connectWallet();
        // Dispatch custom event on successful connection
        window.dispatchEvent(new CustomEvent('cryptique:walletConnected', {
          detail: { 
            address: sessionData.wallet?.walletAddress,
            chain: sessionData.wallet?.chainName,
            element: button // Pass the clicked element for reference
          }
        }));
      } catch (error) {
        console.error('Wallet connection failed:', error);
        // Dispatch error event
        window.dispatchEvent(new CustomEvent('cryptique:walletError', {
          detail: { 
            error: error.message,
            element: button // Pass the clicked element for reference
          }
        }));
      }
    });
  }

  // Auto-bind to wallet connect buttons if they exist
  function setupWalletConnectButton() {
    // Check for ID first
    const connectButtonById = document.getElementById('walletConnectCQ');
    if (connectButtonById) {
      setupWalletButton(connectButtonById);
    }

    // Then check for class
    const connectButtonsByClass = document.getElementsByClassName('walletConnectCQ');
    for (const button of connectButtonsByClass) {
      // Skip if this is the same element we already added by ID
      if (button !== connectButtonById) {
        setupWalletButton(button);
      }
    }
  }

  // Add the SDK to the window object for external access
  window.CryptiqueSDK = {
    ...window.CryptiqueSDK,
    version: VERSION,
    connectWallet, // Expose connectWallet function for external use
    isWalletConnected: checkWalletConnected, // Expose connection check
    trackEvent: trackEvent,
    setTrackingConsent: setTrackingConsent,
    getTrackingConsent: getTrackingConsent,
    updateWalletInfo: updateWalletInfo,
    sessionData: sessionData,
    siteId: SITE_ID
  };
}
