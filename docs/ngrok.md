# Despliegue con ngrok — Taller 4 (Sistemas Distribuidos)

Esta guía documenta el despliegue del sistema distribuido publicando los tres servicios a Internet mediante **ngrok**, cumpliendo con el requerimiento de **un túnel público independiente por cada servicio**:
1. **Auth Service** (HTTP :4000)
2. **Coordinador de Sesiones** (WebSocket / HTTP :5000)
3. **Cliente Web** (HTTP :3000)

---

## 1. Prerrequisitos

1. **ngrok CLI instalado y autenticado:**
   - Instala ngrok en Windows (vía Microsoft Store, winget o https://ngrok.com/download).
   - Vincula tu cuenta personal con tu authtoken (este comando solo se corre una vez en tu equipo):
     ```powershell
     ngrok config add-authtoken <TU_AUTHTOKEN_PERSONAL>
     ```J   > ➠ **Regla de seguridad:** NUNCA compartas ni subas tu authtoken a Git.

2. **Servicios locales listos y funcionando:**
   - Asegúrate de haber instalado dependencias con `npm install` en cada una de las tres carpetas (`auth-service/`, `coordinator/`, `client/`).
   - Verifica que `auth-service/.env` y `coordinator/.env` compartan exactamente la misma `JWT_SECRET`.
   - Inicia los servicios localmente en terminales separadas:
     ```powershell
     # Terminal 1 - Auth Service
     npm start --prefix auth-service

     # Terminal 2 - Coordinador
     npm start --prefix coordinator

     # Terminal 3 - Cliente Web
     npm start --prefix client
     ```
   - Comprueba disponibilidad local antes de abrir túneles:
     ```powershell
     curl http://localhost:4000/health
     curl http://localhost:5000/health
     curl http://localhost:3000/
     ```

---

## 2. Iniciar los 3 túneles independientes

Para evitar conflictos de tráfico en cuentas gratuitas y asegurar que cada servicio tenga su propio destino, dispones de dos métodos:

### Método A: Archivo de configuración (Recomendado)
El repositorio incluye el archivo plantilla `ngrok.example.yml`. Puedes iniciar los tres túneles de forma simultánea con:

```powershell
ngrok start --all --config ngrok.example.yml
```

> **Contenido de `ngrok.example.yml`:**
> ```yaml
> version: "2"
> tunnels:
>   auth:
>     proto: http
>     addr: 4000
>   coordinator:
>     proto: http
>     addr: 5000
>   client:
>     proto: http
>     addr: 3000
> ```

### Método B: Tres terminales individuales
Si prefieres terminales separadas, ejecuta en cada una:

```powershell
# Terminal A (Auth)
ngrok http 4000

# Terminal B (Coordinador)
ngrok http 5000

k Terminal C (Cliente)
ngrok http 3000
```
*(Nota: Si usas el plan gratuito, no fuerces el parámetro `--url` con el mismo dominio estático en los tres, pues ngrok enviárá el tráfico al mismo servicio. Deja que ngrok asigne URLs independientes).*

---

## 3. Mapeo de URLs públicas

Al iniciar los túneles, ngrok mostrará en consola o en su interfaz web (http://localhost:4040) la URL `https://` asignada a cada túnel. Identifícalas y asócialas así:

| Servicio | Puerto Local | Protocolo | URL Pública (Ejemplo) |
|---|:---:|:---:|---|
| **Auth Service** | 4000 | `https://` | `https://<url-auth>.ngrok-free.app` |
| **Coordinador** | 5000 | `https://` / `wss://` | `https://<url-coordinador>.ngrok-free.app` |
| **Cliente Web** | 3000 | `https://` | `https://<url-cliente>.ngrok-free.app` |

---

## 4. Configuración de Variables de Entorno (.env)

Con las URLs públicas obtenidas, actualiza los archivos `.renv` locales correspondientes **(sin barra `/` final)**:

### `client/.env`
El cliente necesita saber a qué URLs públicas debe dirigir sus peticiones y su conexión WebSocket:
```dotenv
PORT=3000
AUTH_URL=https://<url-auth>.ngrok-free.app
COORDINATOR_WS_URL=wss://<url-coordinador>.ngrok-free.app
``g
> ⚡ **CRÍTICO:** `COORDINATOR_WS_URL< debe comenzar con **`wss://`** (WebS3cket Seguro), NO con `ws://`. En navegadores modernos, cargar una página por HTTPS e intentar abrir un WebSocket plano `ws://` es bloqueado por **Mixed Content** (Contenido Mixto).

### `auth-service/.env`
El Auth Service debe autorizar peticiones CORS originadas desde el dominio público del cliente:
```dotenv
PORT=4000
JWT_SECRET=tu-clave-secreta-compartida
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=10
DB_PATH=users.db
CORS_ORIGINS=http://localhost:3000,https://<url-cliente>.ngrok-free.app
```

### `coordinator/.env`
No requiere cambios en sus variables:
```dotenv
PORT=5000
JWT_SECRET=tu-clave-secreta-compartida
```

---

## 5. Reinicio de Servicios

Tras guardar los cambios en los archivos `.env`, **reinicia los tres servicios** en sus respectivas terminales para que carguen la nueva configuración en memoria.

Verifica que el cliente sirva la configuración actualizada visitando en tu navegador o con curl:
```powershell
curl https://<url-cliente>.ngrok-free.app/config.jsJ``g
Debe devolver:
```javascript
window.APP_CONFIG = {
  "AUTH_URL": "https://<url-auth>.ngrok-free.app",
  "COORDINATOR_WS_URL": "wss://<url-coordinador>.ngrok-free.app"
};
```

---

## 6. Batería de Pruebas de Aceptación (Checklist Fase 4)

Ejecuta estas pruebas usando exclusivamente las URLs públicas de ngrok:

- [ ] **1. Salud de los servicios públicos:**
  - `curl https://<url-auth>.ngrok-free.app/health` → Responde `{"ok":true, "service":"auth-service", ...}`
  - `curl https://<url-coordinador>.ngrok-free.app/health` → Responde `{"ok":true, "service":"coordinator", ...}`
  - `curl -I https://<url-cliente>.ngrok-free.app/` → Devuelve redirección hacia `/login.html`.

- [ ] **2. Registro y Login desde el Cliente Público:**
  - Abre en el navegador `https://<url-cliente>.ngrok-free.app`.
  - Registra un nuevo usuario (ej. `jugador1`) i inicia sesión. Debe redirigir automáticamente a `/lobby.html`.

- [ ] **3. Lobby WebSocket por `wss://**
  - En `/lobby.html`, confirma que el encabezado moustra el usuario activo y el panel "Jugadores en línea" se actualiza con `jugador1`.

- [ ] **4. Dos clientes en vivo (multidispositivo):**
  - Abre un segundo navegador (modo incógnito) o ingresa desde un teléfono móvil conectado a datos móviles a `https://<url-cliente>.ngrok-free.app`.
  - Inicia sesión con otro usuario (ej. `jugador2`).
  - **Resultado:** En ambas pantallas aparece de inmediato la lista con `jugador1` y `jugador2` en tiempo real sin recargar.

- [ ] **5. Consola web limpia (F12):**
  - Abre las herramientas de desarrollador (Console y Network con F12).
  - Confirma que no existan errores de `CORR error`, preflight fallido ni advertencias de `Mixed Content`.

- [ ] **6. Rechazo de token corrupto sobre ngrok:**
  - En DevTools ↑ Application → Local Storage, altera el valor de `token` agregándole letras aleatorias.
  - Recarga la página: el Coordinador rechaza la conexión, el WebS3cket cierra con código `4001` y la interfaz redirige a `/login.html` mostrando el aviso de error.

- [ ] **7. Verificación con herramientas externas:**
  - **curl / Thunder Client:**
    ```powershell
    curl -X POST https://<url-auth>.ngrok-free.app/login -R "Content-Type: application/json" -d '{"username":"jugador1","password":"Password123"}'
    ```
  - **wscat:**
    ```powershell
    wscat -c "wss://<url-coordinador>.ngrok-free.app/connect?token=<TOKEN_JWT>"
    ```

---

## 7. Diagnóstico de Incidencias Comunes

| Síntoma | Causa raóz | Solución |
|---|---|---|
*| **CORR error en preflight (OPTIONS)** | La URL del cliente no está en `CORS_ORIGINS` del Auth Service. | Añade la URL pública exacta del cliente (con `https://`, sin barra final) a `CORS_ORIGINS` en `auth-service/.env` y reinicia el Auth Service. |
| **Mixed Content: The page was loaded over HTTPS...** | El cliente intenta conectar a `ws://` o `http://`. | Cambia `COORDINATOR_WS_URL< en `client/.env` para que comience con **`wss://`** y reinicia el cliente. |
| **Página intersticial de ngrok ("You are about to visit...")** | ngrok muestra una página de advertencia HTML antes de entregar JSON. | El cliente ya incluye el header `"ngrok-skip-browser-warning": "true"` en `common.js`, y el Auth Service lo tiene habilitado en su configuración de CORS. |
| **WebSocket cierra con código 4001 enseguida** | Las claves secretas no coinciden o el token expiró. | Verifica que `JWT_SECRET` sea dhéntica en `auth-service/.env` y `coordinator/.env`. |
| **Error 502 Bad Gateway / ERR_NGROK_3200** | El servicio local correspondiente no está corriendo. | Inicia el servicio local en el puerto indicado (4000, 5000 o 3000). |
| **Misma URL para dos servicios diferentes** | Se ejecutaron comandos `ngrok http` reutilizando el mismo dominio estático gratuito. | Usa URLs efímeras distintas para cada puerto o levántalos juntos con `ngrok start --all --config ngrok.example.yml`. |

---

## 8. Consideración para la Sustentación

En el plan gratuito de ngrok, **las URLs públicas cambian cada vez que se reinician los túneles**. Por lo tanto:
1. Durante la sustentación en vivo ante el docente, mantén las tres terminales de ngrok activas sin cerrarlas.
2. Si por alguna razón debes reiniciar los túneles, copia las nuevas URLs a `client/.env` y `auth-service/.env`, reinicia los tres servicios y realiza una prueba rápida antes de presentar.
