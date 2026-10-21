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
  const currentAuth = process.env.AUTH_URL || AUTH_URL;
  const currentWs = process.env.COORDINATOR_WS_URL || COORDINATOR_WS_URL;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  if (host.includes("ngrok") && currentAuth.includes("localhost")) {
    console.warn(`⚡️ ALERTA: Cliente accedido desde ${host}, pero AUTH_URL apunta a localhost (${currentAuth}). Actualiza AUTH_URL en client/.env con la URL de ngrok.`);
  }
  console.log(`[config.js] Servido a	${host || req.ip}: AUTH_URL=${currentAuth}, COORDINATOR_WS_URL=${currentWs}`);
  res
    .type("application/javascript")
    .set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    .send(`window.APP_CONFIG = ${JSON.stringify({ AUTH_URL: currentAuth, COORDINATOR_WS_URL: currentWs })};
`);
});

app.get("/", (req, res) => {
  res.redirect(302, "/login.html");
});

app.use(express.static(publicDirectory));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Cliente web escuchando en http://localhost:${port}`);
});
