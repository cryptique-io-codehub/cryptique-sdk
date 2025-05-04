const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS for all origins
app.use(cors({ 
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

// Set CORS headers explicitly for better compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  // Handle OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

app.use(bodyParser.json());

app.get("/scripts/analytics/1.0.1/cryptique.script.min.js", (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(__dirname + "/script/script.js");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
