const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin:[ "http://localhost:3000",process.env.CORS_ORIGIN] }));
app.use(bodyParser.json());

app.get("/scripts/analytics/1.0.1/cryptique.script.min.js", (req, res) => {
    //i dont want to show any blank spaces  in the content of the file
  res.sendFile(__dirname + "/script/script.js");
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
