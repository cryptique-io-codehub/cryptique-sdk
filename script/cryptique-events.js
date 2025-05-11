/**
 * Cryptique SDK Event Tracking Extension
 * Version: 1.0.0
 * 
 * This extension adds advanced event tracking capabilities to the Cryptique SDK
 * while maintaining full backward compatibility with the existing SDK.
 */

(function(sdk) {
  // Store the original trackEvent function to use internally
  const originalTrackEvent = sdk.trackEvent || function() {
    console.error("Cryptique SDK core trackEvent function not found");
  };
  
  // Add custom event tracking functionality
  sdk.events = {
    // Track a custom event
    track: function(eventName, properties = {}, options = {}) {
      // Create the event data
      const eventData = {
        name: eventName,
        category: options.category || 'custom',
        type: options.type || 'custom',
        value: options.value !== undefined ? options.value : null,
        currency: options.currency || 'USD',
        metadata: properties || {},
        abVariant: options.abVariant || null,
        funnelStep: options.funnelStep || null,
        timestamp: new Date().toISOString()
      };
      
      // Call the original trackEvent function to maintain core tracking
      originalTrackEvent.call(sdk, "CUSTOM_EVENT", eventData);
      
      // Add to current page visit in session WITHOUT modifying existing data structure
      try {
        // Get current session
        const storedSession = sessionStorage.getItem('cryptique_session');
        if (storedSession) {
          const session = JSON.parse(storedSession);
          
          // Make sure we don't break anything if structure isn't as expected
          if (session && session.sessionData && 
              session.sessionData.pageVisits && 
              session.sessionData.pageVisits.length > 0) {
            
            // Get the current page visit (usually the last one)
            const currentPage = session.sessionData.pageVisits[session.sessionData.pageVisits.length - 1];
            
            // Add events array if it doesn't exist - using a non-intrusive approach
            if (!currentPage._events) {
              currentPage._events = [];
            }
            
            // Add event to page visit
            currentPage._events.push(eventData);
            
            // Save back to session storage
            sessionStorage.setItem('cryptique_session', JSON.stringify(session));
          }
        }
      } catch (error) {
        console.error("Error adding event to page visit:", error);
        // Non-critical error - continue even if this fails
      }
      
      return eventData;
    },
    
    // Track a click event (convenience method)
    trackClick: function(elementId, eventName, properties = {}, options = {}) {
      return this.track(eventName || 'click', properties, {
        ...options,
        type: 'click',
        element: elementId
      });
    },
    
    // Track form submission
    trackForm: function(formId, eventName, properties = {}, options = {}) {
      return this.track(eventName || 'form_submit', properties, {
        ...options,
        type: 'form',
        element: formId
      });
    },
    
    // Track a purchase with value
    trackPurchase: function(transactionId, value, currency = 'USD', items = []) {
      return this.track('purchase', {
        transactionId,
        items
      }, {
        category: 'ecommerce',
        type: 'purchase',
        value,
        currency
      });
    },
    
    // Funnel tracking
    trackFunnelStep: function(funnelId, step, stepName, properties = {}) {
      // Get existing funnel data if available
      let funnelData;
      try {
        funnelData = JSON.parse(localStorage.getItem(`cryptique_funnel_${funnelId}`) || '{}');
      } catch (e) {
        funnelData = {};
      }
      
      // Initialize or update funnel data
      if (!funnelData.steps) {
        funnelData = {
          funnelId,
          startTime: new Date().toISOString(),
          currentStep: step,
          steps: [{ step, name: stepName, time: new Date().toISOString() }]
        };
      } else {
        funnelData.currentStep = step;
        funnelData.steps.push({ 
          step, 
          name: stepName, 
          time: new Date().toISOString() 
        });
      }
      
      // Save funnel data
      localStorage.setItem(`cryptique_funnel_${funnelId}`, JSON.stringify(funnelData));
      
      // Track the funnel step event
      return this.track(`funnel_step_${step}`, {
        ...properties,
        funnelId,
        stepName,
        stepNumber: step,
        isFirstStep: step === 1,
        previousSteps: funnelData.steps.slice(0, -1).map(s => s.step)
      }, {
        category: 'funnel',
        type: 'funnel_step',
        funnelStep: step
      });
    },
    
    // A/B Testing support
    getTestVariant: function(testId, variants = ['A', 'B']) {
      const variantKey = `cryptique_ab_${testId}`;
      let variant = localStorage.getItem(variantKey);
      
      // If no variant assigned yet, assign one randomly
      if (!variant && variants && variants.length > 0) {
        // Simple random assignment
        const randomIndex = Math.floor(Math.random() * variants.length);
        variant = variants[randomIndex];
        localStorage.setItem(variantKey, variant);
      }
      
      return variant || 'A';
    },
    
    // Auto-bind events based on configuration
    bindEvents: function(config) {
      if (!config || !Array.isArray(config)) return;
      
      // Process each event configuration
      config.forEach(eventConfig => {
        try {
          // Select elements
          const elements = document.querySelectorAll(eventConfig.selector);
          if (!elements || elements.length === 0) return;
          
          // For each matching element
          elements.forEach(element => {
            // Determine trigger event type
            const eventType = eventConfig.trigger || 'click';
            
            // Handle A/B testing if configured
            let variant = null;
            if (eventConfig.abTest) {
              variant = this.getTestVariant(
                eventConfig.abTest.id, 
                eventConfig.abTest.variants
              );
              
              // Apply variant-specific styling or classes if defined
              if (eventConfig.abTest.variantStyles && 
                  eventConfig.abTest.variantStyles[variant]) {
                const styles = eventConfig.abTest.variantStyles[variant];
                Object.keys(styles).forEach(prop => {
                  element.style[prop] = styles[prop];
                });
              }
              
              if (eventConfig.abTest.variantClasses && 
                  eventConfig.abTest.variantClasses[variant]) {
                element.classList.add(eventConfig.abTest.variantClasses[variant]);
              }
            }
            
            // Attach event listener
            element.addEventListener(eventType, (e) => {
              // Prevent default action if specified
              if (eventConfig.preventDefault) {
                e.preventDefault();
              }
              
              // Extract metadata from element
              const metadata = {};
              
              // Extract standard properties from config
              if (eventConfig.properties) {
                Object.keys(eventConfig.properties).forEach(key => {
                  metadata[key] = eventConfig.properties[key];
                });
              }
              
              // Extract dynamic properties from element
              if (eventConfig.dynamicProperties) {
                Object.keys(eventConfig.dynamicProperties).forEach(key => {
                  const source = eventConfig.dynamicProperties[key];
                  
                  if (source.startsWith('attr:')) {
                    // Get from attribute
                    const attrName = source.slice(5);
                    metadata[key] = element.getAttribute(attrName);
                  } else if (source === 'text') {
                    metadata[key] = element.textContent;
                  } else if (source === 'value') {
                    metadata[key] = element.value;
                  } else if (source === 'checked') {
                    metadata[key] = element.checked;
                  } else if (source === 'id') {
                    metadata[key] = element.id;
                  }
                });
              }
              
              // Get value for tracking
              let value = null;
              if (eventConfig.valueTracking) {
                if (eventConfig.valueTracking.source) {
                  if (eventConfig.valueTracking.source.startsWith('attr:')) {
                    const attrName = eventConfig.valueTracking.source.slice(5);
                    value = element.getAttribute(attrName);
                  } else if (eventConfig.valueTracking.source === 'value') {
                    value = element.value;
                  }
                  
                  // Try to convert to number
                  value = parseFloat(value) || eventConfig.valueTracking.defaultValue || 0;
                } else {
                  value = eventConfig.valueTracking.defaultValue || 0;
                }
              }
              
              // Track the event
              const options = {
                category: eventConfig.category || 'custom',
                type: eventConfig.type || eventType,
                abVariant: variant
              };
              
              // Add value if present
              if (value !== null) {
                options.value = value;
                options.currency = eventConfig.valueTracking?.currency || 'USD';
              }
              
              // Add funnel info if present
              if (eventConfig.funnel) {
                options.funnelStep = eventConfig.funnel.step;
                
                // Also track as funnel step
                this.trackFunnelStep(
                  eventConfig.funnel.id,
                  eventConfig.funnel.step,
                  eventConfig.funnel.name || eventConfig.name,
                  metadata
                );
              } else {
                // Regular event tracking
                this.track(eventConfig.name, metadata, options);
              }
              
              // Handle redirect if configured
              if (eventConfig.redirect) {
                setTimeout(() => {
                  window.location.href = eventConfig.redirect;
                }, eventConfig.redirectDelay || 0);
              }
            });
          });
        } catch (error) {
          console.error(`Error binding event ${eventConfig.name}:`, error);
        }
      });
    }
  };
  
  // Video tracking helper
  sdk.trackVideo = function(videoElement, options = {}) {
    if (!videoElement) return;
    
    const videoId = options.videoId || videoElement.id || 'video';
    const category = options.category || 'video';
    
    // Track play
    videoElement.addEventListener('play', () => {
      sdk.events.track('video_play', {
        videoId,
        src: videoElement.currentSrc,
        position: videoElement.currentTime,
        duration: videoElement.duration
      }, {
        category,
        type: 'video_play'
      });
    });
    
    // Track pause
    videoElement.addEventListener('pause', () => {
      sdk.events.track('video_pause', {
        videoId,
        src: videoElement.currentSrc,
        position: videoElement.currentTime,
        duration: videoElement.duration,
        percentWatched: (videoElement.currentTime / videoElement.duration) * 100
      }, {
        category,
        type: 'video_pause'
      });
    });
    
    // Track complete
    videoElement.addEventListener('ended', () => {
      sdk.events.track('video_complete', {
        videoId,
        src: videoElement.currentSrc,
        duration: videoElement.duration
      }, {
        category,
        type: 'video_complete'
      });
    });
    
    // Track progress at intervals
    if (options.trackProgress !== false) {
      const interval = options.progressInterval || 15; // seconds
      let progressTimer;
      
      videoElement.addEventListener('play', () => {
        progressTimer = setInterval(() => {
          if (!videoElement.paused) {
            const percentWatched = (videoElement.currentTime / videoElement.duration) * 100;
            sdk.events.track('video_progress', {
              videoId,
              src: videoElement.currentSrc,
              position: videoElement.currentTime,
              duration: videoElement.duration,
              percentWatched
            }, {
              category,
              type: 'video_progress'
            });
          }
        }, interval * 1000);
      });
      
      videoElement.addEventListener('pause', () => {
        clearInterval(progressTimer);
      });
      
      videoElement.addEventListener('ended', () => {
        clearInterval(progressTimer);
      });
    }
  };
  
  // Setup auto-binding
  document.addEventListener('DOMContentLoaded', function() {
    // Check if there's a configuration endpoint defined
    if (sdk.eventConfigUrl) {
      // Fetch configuration from server
      fetch(sdk.eventConfigUrl)
        .then(response => response.json())
        .then(config => {
          sdk.events.bindEvents(config);
        })
        .catch(error => {
          console.error("Error loading event configuration:", error);
        });
    }
  });
  
})(window.CryptiqueSDK || (window.CryptiqueSDK = {})); 