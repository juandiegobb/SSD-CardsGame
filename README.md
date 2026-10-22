# Taller 4: Sistemas Distribuidos — Proyecto Final (Parte I: Identidad y Sesiones)

> **Universidad de Boyacá — Facultad de Ciencias e Ingeniería**  
> **Asignatura:** Sistemas Distribuidos  
> **Repositorio Oficial:** [https://github.com/juandiegobb/SSD-CarsGame.git](https://github.com/juandiegobb/SSD-CarsGame.git)  

Este repositorio contiene la **Parte I del Proyecto Final**, correspondiente a la arquitectura base de **autenticación, coordinación de sesiones en tiempo real y cliente web**. Constituye el núcleo de identidad de un futuro videojuego multijugador distribuido en web.

> ℹ️ **Nota de Alcance:** Esta primera entrega aborda exclusivamente el registro, autenticación con JWT, persistencia en SQLite, presencia de jugadores en vivo mediante WebSocket y despliegue público seguro con túneles ngrok. **No incluye** lógica de movimiento, físicas ni replicación de estados de juego (reservados para entregas posteriores).

---

## Tabla de Contenido
1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Estructura del Repositorio](#2-estructura-del-repositorio)
3. [Requisitos Previos](#3-requisitos-previos)
4. [Instalación y Puesta en Marcha](#4-instalación-y-puesta-en-marcha)
5. [Referencia de API (Contratos y Códigos)](#5-referencia-de-api-contratos-y-códigos)
6. [Pruebas de la API (curl y Thunder Client)](#6-pruebas-de-la-api-curl-y-thunder-client)
7. [Pruebas del WebSocket (wscat)](#7-pruebas-del-websocket-wscat)
8. [Decisiones de Diseño Justificadas](#8-decisiones-de-diseño-justificadas)
9. [Despliegue Público con ngrok](#9-despliegue-público-con-ngrok)
10. [Guion Rápido para la Sustentación](#10-guion-rápido-para-la-sustentación)
11. [Errores Típicos y Cómo Evitarlos](#11-errores-típicos-y-cómo-evitarlos)
12. [Equipo y Reparto de Fases](#12-equipo-y-reparto-de-fases)

---

## 1. Arquitectura del Sistema

El sistema implementa un desacoplamiento estricto en tres servicios independientes:

```mermaid
flowchart TD
    subgraph Clientes ["Clientes Web (Navegadores)"]
        BrowserA["Cliente A (Pestaña / Móvil)"]
        BrowserB["Cliente B (Pestaña / PC)"]
    end

    subgraph NgrokTunnels ["Túneles ngrok (Fase 4)"]
        TunnelClient["Túnel Cliente :3000 (HTTPS)"]
        TunnelAuth["Túnel Auth :4000 (HTTPS)"]
        TunnelCoord["Túnel Coordinador :5000 (WSS)"]
    end

    subgraph Backend ["Servicios Distribuidos (Node.js)"]
        ClientApp["Cliente Web (:3000)<br>Express estático + /config.js"]
        AuthService["Auth Service (:4000)<br>Express + bcrypt + JWT"]
        Coordinator["Coordinador (:5000)<br>HTTP + WebSocket Server"]
        DB[("users.db<br>SQLite / WAL")]
        MemoryMap[["players Map<br>(En memoria)"]]
    end

    %% Conexiones Clientes -> Túneles
    BrowserA -->|HTTPS| TunnelClient
    BrowserB -->|HTTPS| TunnelClient
    BrowserA -->|HTTPS POST| TunnelAuth
    BrowserB -->|HTTPS POST| TunnelAuth
    BrowserA -->|WSS /connect?token=JWT| TunnelCoord
    BrowserB -->|WSS /connect?token=JWT| TunnelCoord

    %% Túneles -> Backend
    TunnelClient --> ClientApp
    TunnelAuth --> AuthService
    TunnelCoord --> Coordinator

    %% Backend interno
    AuthService <-->|CRUD seguro| DB
    Coordinator <-->|Gestión de sockets| MemoryMap
    AuthService -.->|Firma JWT (HS256)<br>Misma JWT_SECRET| Coordinator
```

### Flujo de Vida de una Sesión:
1. **Registro:** El cliente envía `POST /register` con `{ username, password }` al Auth Service. El password se hashea con `bcrypt` (10 rounds) y se guarda en SQLite.
2. **Login:** El cliente envía `POST /login`. El Auth Service valida las credenciales y genera un **JWT** firmado (algoritmo `HS256`, vigencia configurable).
3. **Handshake WebSocket:** El cliente abre conexión a `ws://host:5000/connect?token=<JWT>` (o `wss://`). El Coordinador intercepta el evento HTTP `upgrade` y valida el token antes de aceptar el socket.
4. **Presencia en Vivo:** El Coordinador registra al jugador en un `Map` en memoria (`userId -> { username, socket, ... }`) y emite un broadcast `players_update` a todos los clientes conectados.

---

## 2. Estructura del Repositorio

```text
SSD-CarsGame/
├── auth-service/              # Servicio de Autenticación (Puerto 4000)
│   ├── index.js               # API REST Express, SQLite y emisor de JWT
│   ├── package.json           # Dependencias: express, better-sqlite3, bcrypt, jsonwebtoken, dotenv
│   ├── .env.example           # Plantilla de variables de entorno del Auth
│   └── users.db               # Base de datos SQLite (ignorado en .gitignore)
├── coordinator/               # Coordinador de Sesiones WebSocket (Puerto 5000)
│   ├── index.js               # Verificación en upgrade, Map de presencia y broadcast
│   ├── package.json           # Dependencias: express, ws, jsonwebtoken, dotenv
│   └── .env.example           # Plantilla de variables de entorno del Coordinador
├── client/                    # Cliente Web Frontend y Servidor Estático (Puerto 3000)
│   ├── server.js              # Servidor Express estático y endpoint dinámico /config.js
│   ├── package.json           # Dependencias: express, dotenv
│   ├── .env.example           # Plantilla de variables del cliente
│   └── public/                # Archivos estáticos del frontend
│       ├── login.html         # Formulario bimodal: Registro e Iniciar Sesión
│       ├── lobby.html         # Vista en vivo de jugadores conectados y logout
│       ├── common.js          # Utilidades compartidas (API, localStorage, headers)
│       └── style.css          # Estilos visuales del cliente
├── docs/                      # Documentación técnica adicional
│   └── ngrok.md               # Guía completa de despliegue con ngrok
├── worker/                    # Componente reservado para futuras fases (física/movimiento)
│                              # (No se utiliza en este Taller 4 - Parte I)
├── ngrok.example.yml          # Plantilla para ejecutar 3 túneles ngrok simultáneos
├── .env.example               # Referencia global de variables
├── .gitignore                 # Reglas de exclusión (ignora .env, *.db, node_modules)
├── SPEC.md                    # Especificación formal y contratos del taller
├── AGENTS.md                  # Roles, guías colaborativas y políticas de desarrollo
└── README.md                  # Documentación principal del proyecto
```

---

## 3. Requisitos Previos

* **Node.js:** Versión `18.0.0` o superior (Recomendado: `Node.js 20.x LTS` o `Node.js 22.x LTS`).
  * *Verificado y probado con Node.js v24.20.0 y npm v11.19.0.*
* **npm:** Gestor de paquetes incluido con Node.js.
* **ngrok:** CLI oficial de ngrok (v3.x) para túneles públicos.
* **wscat (opcional para terminal):** Cliente de terminal para WebSockets (`npm install -g wscat`).
* **Thunder Client / Postman / curl:** Para pruebas de endpoints HTTP.

---

## 4. Instalación y Puesta en Marcha

### 4.1. Clonar el Repositorio
```bash
git clone https://github.com/juandiegobb/SSD-CarsGame.git
cd SSD-CarsGame
```

### 4.2. Instalar Dependencias
Cada servicio es un paquete independiente con su propio `package.json`:
```bash
npm install --prefix auth-service
npm install --prefix coordinator
npm install --prefix client
```

### 4.3. Configuración de Variables de Entorno (`.env`)

Copia los archivos de ejemplo en cada servicio:

1. **Generar una `JWT_SECRET` segura:**
   Ejecuta el siguiente comando en tu terminal para generar una clave criptográfica aleatoria de 32 bytes:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Configurar `auth-service/.env`:**
   ```dotenv
   PORT=4000
   JWT_SECRET=pega_aqui_la_clave_generada
   JWT_EXPIRES_IN=1h
   BCRYPT_ROUNDS=10
   DB_PATH=users.db
   CORS_ORIGINS=http://localhost:3000
   ```

3. **Configurar `coordinator/.env`:**
   > ⚠️ **CRÍTICO:** La variable `JWT_SECRET` debe ser **EXACTAMENTE LA MISMA** que la configurada en `auth-service/.env`. Si difieren, el Coordinador rechazará los tokens con error `TOKEN_INVALID_SIGNATURE`.
   ```dotenv
   PORT=5000
   JWT_SECRET=pega_aqui_la_clave_generada
   ```

4. **Configurar `client/.env`:**
   ```dotenv
   PORT=3000
   AUTH_URL=http://localhost:4000
   COORDINATOR_WS_URL=ws://localhost:5000
   ```

### 4.4. Orden Recomendado de Arranque
Abre 3 terminales separadas en la raíz del proyecto y arranca en este orden:

```powershell
# Terminal 1: Auth Service (Primero para inicializar DB y autenticación)
npm start --prefix auth-service

# Terminal 2: Coordinador (Para habilitar el WebSocket de presencia)
npm start --prefix coordinator

# Terminal 3: Cliente Web (Para servir los formularios y lobby)
npm start --prefix client
```

Abre en tu navegador: [http://localhost:3000](http://localhost:3000) (redirige automáticamente a `/login.html`).

---

## 5. Referencia de API (Contratos y Códigos)

### 5.1. Formato Uniforme de Respuestas (SPEC.md §3.1)
Todas las respuestas JSON del sistema respetan un estándar uniforme:

* **Éxito:**
  ```json
  {
    "ok": true,
    "message": "Descripción legible de la operación exitosa.",
    "campoExtra": "..."
  }
  ```
* **Error:**
  ```json
  {
    "ok": false,
    "code": "CODIGO_EN_MAYUSCULAS",
    "message": "Explicación clara del error ocurrido.",
    "hint": "Instrucción de cómo corregirlo o continuar.",
    "details": [] 
  }
  ```

### 5.2. Catálogo de Códigos de Error HTTP (Auth Service)
| Código HTTP | `code` | Motivo |
|---|---|---|
| `400 Bad Request` | `INVALID_BODY` | El cuerpo de la petición no es JSON válido. |
| `400 Bad Request` | `INVALID_USERNAME` | Username no cumple longitud (3–32) o caracteres válidos. |
| `400 Bad Request` | `INVALID_PASSWORD` | Contraseña menor a 8 o mayor a 72 caracteres (límite bcrypt). |
| `400 Bad Request` | `MISSING_FIELDS` | Faltan campos requeridos en el inicio de sesión. |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Usuario no existe o contraseña incorrecta (mensaje genérico anti-enumeración). |
| `409 Conflict` | `USERNAME_TAKEN` | El nombre de usuario ya está registrado en SQLite. |
| `404 Not Found` | `NOT_FOUND` | Ruta o método no existente en la API. |

### 5.3. Catálogo de Mensajes y Códigos WebSocket (Coordinador)
* **Cliente → Servidor:**
  * `{"type":"ping"}` → Responde `{"type":"pong", "ok":true, "serverTime":"..."}`
  * `{"type":"who"}` → Responde `players_update` únicamente al socket que solicitó.
  * Mensaje no reconocido → Responde error `UNKNOWN_MESSAGE_TYPE` (no cierra socket).
  * Texto no JSON → Responde error `INVALID_JSON` (no cierra socket).

* **Servidor → Cliente:**
  * `{"type":"connected", "ok":true, "userId":"1", "username":"alice", "onlineCount":1}`
  * `{"type":"players_update", "players":[{"userId":"1", "username":"alice"}]}`
  * `{"type":"error", "code":"...", "message":"...", "hint":"..."}`

* **Códigos de Cierre (Close Codes):**
  | Código | Razón | Causado por | Reacción esperada en Cliente |
  |---|---|---|---|
  | `1000` | `"logout"` | Cliente (Botón 'Cerrar sesión') | Cierre intencional; borra token y redirige a login sin error. |
  | `4001` | `"invalid token"` | Coordinador (Token vencido, corrupto o mala firma) | Borra token de `localStorage` y redirige a login con aviso. |
  | `4002` | `"session replaced"` | Coordinador (Mismo usuario abrió otra pestaña) | Cierra pestaña vieja; **NO** borra token (política doble pestaña). |
  | `4003` | `"token expired"` | Coordinador (Venció el JWT con socket abierto) | Expulsión en caliente; borra token y redirige a login con aviso. |

---

## 6. Pruebas de la API (curl y Thunder Client)

### 6.1. Comandos curl Verificados

#### 1. Salud de los servicios
```bash
curl -s http://localhost:4000/health
# {"ok":true,"message":"Servicio de autenticación operativo.","service":"auth-service","uptime":12}

curl -s http://localhost:5000/health
# {"ok":true,"message":"Coordinador operativo.","service":"coordinator","uptime":15,"onlineCount":0}
```

#### 2. Registro exitoso (201 Created)
```bash
curl -i -X POST http://localhost:4000/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"password\":\"Password123\"}"
```
*Respuesta real:*
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "ok": true,
  "message": "Usuario registrado exitosamente.",
  "userId": "1",
  "username": "alice"
}
```

#### 3. Registro duplicado (409 Conflict)
```bash
curl -i -X POST http://localhost:4000/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"password\":\"Password123\"}"
```
*Respuesta real:*
```http
HTTP/1.1 409 Conflict

{
  "ok": false,
  "code": "USERNAME_TAKEN",
  "message": "El nombre de usuario ya está registrado.",
  "hint": "Elige otro username o inicia sesión en POST /login."
}
```

#### 4. Login exitoso (200 OK — Emisión de JWT)
```bash
curl -i -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"password\":\"Password123\"}"
```
*Respuesta real:*
```http
HTTP/1.1 200 OK

{
  "ok": true,
  "message": "Autenticación exitosa.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "1",
  "username": "alice",
  "expiresIn": 3600
}
```

#### 5. Login fallido (401 Unauthorized — Genérico)
```bash
curl -i -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"password\":\"clave_erronea\"}"
```
*Respuesta real:*
```http
HTTP/1.1 401 Unauthorized

{
  "ok": false,
  "code": "INVALID_CREDENTIALS",
  "message": "Credenciales inválidas.",
  "hint": "Verifica tu usuario y contraseña."
}
```

### 6.2. Colección sugerida para Thunder Client / Postman
En Thunder Client:
1. Crea variables de entorno: `BASE_AUTH = http://localhost:4000` y `BASE_COORD = http://localhost:5000`.
2. En la prueba de `POST /login`, ve a la pestaña **Tests** y guarda el token automáticamente:
   ```javascript
   tc.setVar("TOKEN", tc.response.json.token, "environment");
   ```
3. Realiza peticiones de diagnóstico: `GET {{BASE_COORD}}/players` para verificar la lista de jugadores conectados.

---

## 7. Pruebas del WebSocket (wscat)

Con el Coordinador ejecutándose en el puerto 5000:

#### 1. Conexión exitosa con token
```bash
wscat -c "ws://localhost:5000/connect?token=<TOKEN_JWT>"
```
*Salida inmediata recibida:*
```json
< {"type":"connected","ok":true,"message":"Conexión autenticada como alice.","userId":"1","username":"alice","onlineCount":1}
< {"type":"players_update","players":[{"userId":"1","username":"alice"}]}
```

#### 2. Ping / Pong y Who
Estando conectado en `wscat`:
* Enviar: `{"type":"ping"}`
  * Recibe: `{"type":"pong","ok":true,"message":"Conexión viva.","serverTime":"2026-10-21T..."}`
* Enviar: `{"type":"who"}`
  * Recibe: `{"type":"players_update","players":[{"userId":"1","username":"alice"}]}` (solo al emisor).

#### 3. Casos de Error en Handshake (Cierre 4001)
* **Sin token:** `wscat -c "ws://localhost:5000/connect"`  
  → Recibe `TOKEN_MISSING` y desconexión con código `4001 (invalid token)`.
* **Token malformado:** `wscat -c "ws://localhost:5000/connect?token=basura"`  
  → Recibe `TOKEN_MALFORMED` y desconexión con código `4001`.
* **Firma errónea:** Conectar con un token firmado con otra secret  
  → Recibe `TOKEN_INVALID_SIGNATURE` y desconexión con código `4001`.
* **Token expirado:** Conectar con un token cuyo `exp` ya pasó  
  → Recibe `TOKEN_EXPIRED` y desconexión con código `4001`.

---

## 8. Decisiones de Diseño Justificadas

Esta sección sustenta los requerimientos clave exigidos en el taller:

1. **Política de Doble Pestaña (Reemplazo con cierre 4002):**
   * *Decisión:* La conexión más reciente sustituye a la sesión anterior del mismo `userId`.
   * *Por qué:* Los refrescos de página (`F5`) o micro-cortes de red dejan sockets "zombi" en el servidor. Rechazar la nueva conexión bloquearía al usuario. Al dar prioridad a la intención más reciente, se cierra el socket viejo con `4002 "session replaced"`.
   * *Detalle crítico:* En el evento `close`, solo se elimina del `Map` si el socket que cierra es el socket actualmente activo (`players.get(userId)?.socket === ws`), evitando que el cierre asíncrono del viejo borre al nuevo. Además, el cliente no borra el token en `4002` para evitar bucles de expulsión mutua entre pestañas.

2. **Verificación de JWT en el evento `upgrade` HTTP:**
   * *Decisión:* La validación criptográfica ocurre antes de completar el handshake del WebSocket, no dentro del evento `connection`.
   * *Por qué:* Cumple el Error Típico #3 del PDF. Evita reservar recursos de socket a conexiones no autorizadas. Para permitir que el cliente reciba el JSON descriptivo de error, el servidor acepta el upgrade de manera temporal, emite el payload `type: 'error'` y acto seguido cierra con `4001 'invalid token'`.

3. **Temporizador de Expiración en Caliente (Cierre 4003):**
   * *Decisión:* Al conectarse, el Coordinador calcula `msUntilExpiry = payload.exp * 1000 - Date.now()` y programa un `setTimeout`.
   * *Por qué:* Por naturaleza de los WebSockets, un canal abierto no vuelve a enviar headers HTTP. Si el token vence a los 30 segundos, el socket seguiría vivo indefinidamente a menos que el servidor controle activamente el tiempo de expiración. Al cumplirse, notifica `TOKEN_EXPIRED` y cierra con `4003 'token expired'`.

4. **Contraseñas con bcrypt (≥ 10 rounds) y Hash Ficticio:**
   * *Decisión:* `bcrypt` configurado con mínimo 10 rounds de salting. En el login, si el usuario no existe, se ejecuta un hash ficticio (`DUMMY_HASH`).
   * *Por qué:* 10 rounds ofrece resistencia moderna contra ataques por fuerza bruta. El hash ficticio neutraliza **ataques de temporización (timing attacks)**, garantizando que el tiempo de respuesta sea idéntico tanto si el usuario existe como si no.

5. **Código 401 Genérico y `userId` como String:**
   * *Decisión:* `/login` responde siempre `401 INVALID_CREDENTIALS` sin indicar si falló el usuario o la contraseña.
   * *Por qué:* Previene la **enumeración de usuarios**. El `userId` se maneja siempre como `string` para garantizar compatibilidad con cualquier motor de base de datos futuro (ej. UUIDs o MongoDB ObjectIDs).

6. **Límites de Validación (3–32 username, 8–72 password):**
   * *Por qué:* El límite de 72 caracteres en la contraseña responde a la restricción interna del algoritmo de cifrado `bcrypt` (que trunca silenciosamente a partir del byte 72).

7. **Arquitectura Sin Estado (Stateless) y Base de Datos Aislada:**
   * *Decisión:* SQLite reside únicamente en el Auth Service. El Coordinador no tiene conexión a la base de datos.
   * *Por qué:* Principio de responsabilidad única. El Coordinador no necesita consultar disco para validar identidades; la firma criptográfica del JWT (`HS256`) garantiza matemáticamente la validez del jugador en memoria.

8. **Configuración Dinámica del Cliente (`/config.js`):**
   * *Decisión:* El cliente web obtiene `AUTH_URL` y `COORDINATOR_WS_URL` en tiempo de ejecución solicitando `/config.js`, en lugar de compilar URLs estáticas.
   * *Por qué:* Permite cambiar entre pruebas locales (`localhost`) y URLs públicas de ngrok simplemente ajustando variables de entorno, sin tener que reconstruir o editar código del frontend.

---

## 9. Despliegue Público con ngrok

El sistema soporta despliegue mediante **tres túneles independientes** (uno por servicio):

```text
ngrok http 4000  --> https://<auth>.ngrok-free.app
ngrok http 5000  --> https://<coord>.ngrok-free.app  (y wss:// para WebSocket)
ngrok http 3000  --> https://<cliente>.ngrok-free.app
```

### 9.1. Inicio Simultáneo con Plantilla
Usa la plantilla versionable [`ngrok.example.yml`](ngrok.example.yml):
```powershell
ngrok start --all --config ngrok.example.yml
```

### 9.2. Ajuste de Variables `.env` para ngrok
* **`client/.env`**:
  ```dotenv
  PORT=3000
  AUTH_URL=https://<url-auth>.ngrok-free.app
  COORDINATOR_WS_URL=wss://<url-coordinador>.ngrok-free.app
  ```
  > ⚡ **CRÍTICO:** `COORDINATOR_WS_URL` debe usar **`wss://`** (WebSocket Seguro). Si se usa `ws://` sobre una página cargada en HTTPS, los navegadores bloquean la conexión por **Contenido Mixto (Mixed Content)**.

* **`auth-service/.env`**:
  ```dotenv
  CORS_ORIGINS=http://localhost:3000,https://<url-cliente>.ngrok-free.app
  ```

> 📌 **Nota sobre el Plan Gratuito:** Las URLs de ngrok cambian al reiniciar el proceso. Si se reinician los túneles, actualiza los `.env` y reinicia los servicios locales.

---


## 10. Errores Típicos y Cómo Evitarlos

* **Verificar JWT en `connection` en lugar de `upgrade`:** Permite que conexiones no autenticadas abran sockets. Se evitó interceptando el evento `server.on('upgrade')`.
* **Cierre del socket viejo borrando al nuevo:** Al abrir dos pestañas con el mismo usuario, el cierre asíncrono del primero podía borrar la entrada recién creada del segundo. Se evitó validando `if (players.get(userId)?.socket === ws)`.
* **Bloqueo por Mixed Content:** Conectar a `ws://` desde un cliente HTTPS. Se resolvió forzando `wss://` en las variables de entorno de ngrok.
* **Página intersticial de ngrok en peticiones fetch:** ngrok gratuito muestra una pantalla HTML si falta la cabecera adecuada. Se solucionó enviando `"ngrok-skip-browser-warning": "true"` en cada `fetch()` de [client/public/common.js](client/public/common.js).
* **Olvidar limpiar temporizadores:** Si un jugador cierra la pestaña voluntariamente, el timer de expiración en caliente debe cancelarse con `clearTimeout()` para no disparar llamadas sobre sockets cerrados.

---

## 12. Equipo y Reparto de Fases

| Fase | Componente / Responsabilidad | Integrante Responsable |
|:---:|---|---|
| **Fase 0** | Estructura del repositorio, configuración base y scripts | Juan Diego Castillo |
| **Fase 1** | Auth Service (Endpoints, SQLite, bcrypt, JWT) | Juan Diego Castillo |
| **Fase 2** | Coordinador de Sesiones (WebSocket, Upgrade, Broadcast) | Juan Diego Castillo |
| **Fase 3** | Cliente Web (HTML, CSS, JS, Login, Lobby en vivo) | Camilo Alarcón |
| **Fase 4** | Despliegue con ngrok (Túneles, HTTPS/WSS, CORS) | Camilo Alarcón |
| **Fase 5** | Documentación técnica integral (README.md) | Juan Diego Castillo |
| **Fase 6** | Verificación cruzada, pruebas de integración y sustentación | Juan Diego Castillo / Camilo Alarcón / paula becerra / Mery Ortiz |
