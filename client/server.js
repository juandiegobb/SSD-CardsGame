require("dotenv").config();

const express = require("express");
const path = require("node:path");

const { AUTH_URL, COORDINATOR_WS_URL } = process.env;
if (!AUTH_URL || !COORDINATOR_WS_URL) {
  throw new Error("Faltan AUTH_URL y/o COORDINATOR_WS_URL en el archivo .env del cliente.");
}

const app = express();
const publicDirectory = path.join(__dirname, "public");

app.get("/config.js", (req, res) => {
  res
    .type("application/javascript")
    .set("Cache-Control", "no-store")
    .send(`window.APP_CONFIG = ${JSON.stringify({ AUTH_URL, COORDINATOR_WS_URL })};`);
});

app.get("/", (req, res) => {
  res.redirect(302, "/login.html");
});

app.use(express.static(publicDirectory));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Cliente web escuchando en http://localhost:${port}`);
});
