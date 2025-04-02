const API_URL = 'https://cryptique-backend.vercel.app/api/sdk/track';
const VERSION = 'v0.11.21';
const CONSENT_STORAGE_KEY = 'mtm_consent';
const USER_ID_KEY = 'mtm_user_id';
const analyticsScript = document.currentScript || document.querySelector('script[src*="script.js"]');
const SITE_ID = analyticsScript.getAttribute('site-id');


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

    country:null
};
//countryName


// 🚀 Utility Functions
function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function getOrCreateUserId() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
        userId = 'usr_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
}

function getTrackingConsent() {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
}

function setTrackingConsent(consent) {
    localStorage.setItem(CONSENT_STORAGE_KEY, consent ? 'true' : 'false');
}

function getUTMParameters() {
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    let storedUTM = {};
    utmParams.forEach(param => {
        storedUTM[param] = localStorage.getItem(param) || '';
    });
    return storedUTM;
}

function getStoredReferrer() {
    return localStorage.getItem('referrer') || document.referrer;
}
function getBrowserAndDeviceInfo() {
    const userAgent = navigator.userAgent;
    let deviceType = 'desktop';

    if (/Mobi|Android/i.test(userAgent)) {
        deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'tablet';
    }

    return {
        browser: {
            name: navigator.userAgentData?.brands?.[0]?.brand || navigator.appName,
            version: navigator.appVersion
        },
        device: {
            type: deviceType,
            os: navigator.platform,
            resolution: `${window.screen.width}x${window.screen.height}`
        }
    };
}

// 🛠️ Activity Tracking Functions
function trackDailyActivity() {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('lastActiveDate');
    if (today !== lastActive) {
        localStorage.setItem('lastActiveDate', today);
        return true;
    }
    return false;
}

function trackWeeklyActivity() {
    const currentWeek = getWeekNumber(new Date());
    const lastWeek = localStorage.getItem('lastActiveWeek');
    if (currentWeek !== lastWeek) {
        localStorage.setItem('lastActiveWeek', currentWeek);
        return true;
    }
    return false;
}

function trackMonthlyActivity() {
    const currentMonth = new Date().getMonth();
    const lastMonth = localStorage.getItem('lastActiveMonth');
    if (currentMonth !== lastMonth) {
        localStorage.setItem('lastActiveMonth', currentMonth);
        return true;
    }
    return false;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}

// 📈 Page View and Event Tracking
function trackPageView() {
    userSession.pagesPerVisit++;
    if (userSession.pagesPerVisit > 1) userSession.isBounce = false;

    trackEvent('PAGEVIEW', {
        pageUrl: window.location.href,
        pageTitle: document.title,
        userActivity: {
            dau: trackDailyActivity(),
            wau: trackWeeklyActivity(),
            mau: trackMonthlyActivity()
        }
    });
}
let sessionData = {
    sessionId: generateSessionId(),
    siteId: SITE_ID,
    referrer: document.referrer || 'direct',
    utmData: getUTMParameters(),
    startTime: new Date().toISOString(),
    endTime: null,
    pagesViewed: 0,
    duration: 0,
    isBounce: true,
    country: '', 
    device:getBrowserAndDeviceInfo().device,
 browser:getBrowserAndDeviceInfo().browser
    
};
let timer;
let countryName;
function getCountryName() {
    fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
        countryName = data.country_name;
        sessionData.country = countryName;
    })
    .catch(err => console.error('Error:', err));
    return countryName;
}
function startSessionTracking() {
    sessionData.pagesViewed++;
    sessionData.country = countryName;
    timer = setInterval(() => {
        const currentTime = new Date();
        sessionData.endTime = currentTime.toISOString();
        sessionData.duration = Math.round((currentTime - new Date(sessionData.startTime)) / 1000);
        sessionData.isBounce = sessionData.pagesViewed === 1;
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({sessionData})
        })
        .then(res => res.json())
        // .then(res => console.log('Session sent:', res.message))
        .catch(err => console.error('Error:', err));
    }, 5000);  // Send data every 5 seconds
}
window.addEventListener('beforeunload', () => {
    sessionData.pagesViewed++;
    sessionData.endTime = new Date().toISOString();
    sessionData.duration = Math.round((new Date() - new Date(sessionData.startTime)) / 1000);
    sessionData.isBounce = sessionData.pagesViewed === 1;
    navigator.sendBeacon(API_URL, JSON.stringify(sessionData));
    clearInterval(timer);  // Stop the timer
});   
 function setupWalletTracking() {
    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
            if (accounts.length > 0) {
                userSession.walletAddresses = accounts;
            }
        });

        window.ethereum.on('accountsChanged', accounts => {
            userSession.walletAddresses = accounts;
        });

        window.ethereum.on('chainChanged', chainId => {
            userSession.chainId = chainId;
        });
    }
}

function trackEvent(eventType, eventData = {}) {
    userSession.country = getCountryName();
    const payload = {
        siteId: SITE_ID,
        websiteUrl: window.location.href,
        userId: userSession.userId,
        sessionId: userSession.sessionId,
        type: eventType,
        pagePath: window.location.pathname,
        // walletAddresses: userSession.walletAddresses,
        chainId: userSession.chainId,
        walletsConnected: userSession.walletAddresses.length,
        eventData: {
            ...eventData,
            ...userSession.utmData,
            referrer: userSession.referrer,
            sessionDuration: Date.now() - userSession.sessionStart,
            pagesPerVisit: userSession.pagesPerVisit,
            isBounce: userSession.isBounce,
            browser: userSession.browser,
            os: userSession.os,
            deviceType: userSession.deviceType,
            resolution: userSession.resolution,
            language: userSession.language,
            country: userSession.country,
        },
        timestamp: new Date().toISOString(),
        version: VERSION
    };
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload })
    })
        .then(res => res.json())
        .then(result => console.log('API Response:', result))
        .catch(error => console.error('Error:', error));
}

// 🚀 Initialization
function initCryptiqueAnalytics() {
    getCountryName();
    // setupWalletTracking();
    trackPageView();
    startSessionTracking();
}

// Start Analytics
initCryptiqueAnalytics();
