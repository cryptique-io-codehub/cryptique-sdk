# Cryptique Analytics SDK

A lightweight SDK for integrating the Cryptique Analytics platform into any website for collecting user behavior and Web3 interaction data.

## Overview

The Cryptique SDK allows website owners to easily track user interactions, page views, and blockchain interactions on their websites. The SDK is designed to be lightweight, easy to integrate, and highly configurable.

## Features

- **Real-time tracking**: Collect data about user interactions in real-time
- **Session management**: Track users across page loads with accurate session attribution
- **Web3 integration**: Track cryptocurrency wallet connections and transactions
- **Custom event tracking**: Define and track custom events specific to your application
- **Privacy-focused**: Designed with privacy regulations in mind, including consent management
- **Minimal performance impact**: Lightweight implementation that doesn't slow down your site

## Installation

### 1. Add the Script Tag

Add the following script tag to the `<head>` section of your website:

```html
<script async src="https://cryptique-sdk.vercel.app/scripts/analytics/1.0.1/cryptique.script.min.js"></script>
```

### 2. Initialize the SDK

Initialize the SDK with your site ID:

```html
<script>
  window.cryptiqueSettings = {
    siteId: 'YOUR_SITE_ID',
    trackPageViews: true,
    trackClicks: true,
    trackWeb3: true,
    consentRequired: false
  };
</script>
```

## Configuration Options

The SDK can be configured with the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `siteId` | String | Required | Your unique site identifier |
| `trackPageViews` | Boolean | `true` | Automatically track page views |
| `trackClicks` | Boolean | `true` | Track user clicks on the page |
| `trackWeb3` | Boolean | `true` | Track Web3 wallet connections and transactions |
| `consentRequired` | Boolean | `false` | Require user consent before tracking |
| `dataEndpoint` | String | Default endpoint | Custom endpoint for sending data |
| `sessionTimeout` | Number | `30` | Session timeout in minutes |

## API Reference

### Tracking Custom Events

You can track custom events using the `cryptique.track()` method:

```javascript
// Track a simple event
window.cryptique.track('button_click');

// Track an event with additional data
window.cryptique.track('purchase_completed', {
  product_id: '12345',
  value: 99.99,
  currency: 'USD'
});
```

### Web3 Integration

The SDK automatically tracks wallet connections and transactions on sites that use Web3 libraries like ethers.js or web3.js. For manual tracking, you can use:

```javascript
// Track a wallet connection
window.cryptique.trackWalletConnection('0x1234...', 'metamask', 'ethereum');

// Track a transaction
window.cryptique.trackTransaction({
  hash: '0xabc123...',
  from: '0x1234...',
  to: '0x5678...',
  value: '0.5',
  chainId: 1
});
```

### Managing User Consent

If you enable the `consentRequired` option, you need to explicitly give consent before tracking begins:

```javascript
// Give consent for tracking
window.cryptique.setConsent(true);

// Revoke consent
window.cryptique.setConsent(false);
```

## Development

### Project Structure

```
cryptique-sdk/
├── script/                 # Client-side scripts
│   └── script.js           # Main tracking script
├── index.js                # Server for script delivery
├── package.json            # Dependencies and scripts
└── vercel.json             # Deployment configuration
```

### Setup Local Development Environment

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. The server will run on http://localhost:3002

### Building for Production

```bash
npm run build
```

## Data Collection

The SDK collects the following data by default:

- **Page views**: URL, referrer, title, visit time
- **Session data**: Session duration, pages per session
- **User data**: Browser, OS, device type, country (derived from IP)
- **Web3 data**: Wallet connections, transactions (if enabled)
- **Performance**: Page load time, time to interactive

## Security and Privacy

- All data is transmitted securely using HTTPS
- Personally identifiable information (PII) is not collected by default
- IP addresses are only used for country detection and then discarded
- Compliance with GDPR, CCPA, and other privacy regulations when using the consent feature

## Support

For questions or support, please contact:
- Email: support@cryptique.io
- Documentation: https://docs.cryptique.io
- GitHub Issues: Submit an issue in the repository

## License

[MIT License](LICENSE) 