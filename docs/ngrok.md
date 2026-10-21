# Despliegue local con ngrok

Esta guía publica los tres servicios locales con tres endpoints ngrok distintos. No
incluyas el authtoken, secretos ni URLs públicas reales en archivos del repositorio.

## Prerrequisitos

- Instala ngrok para Windows desde Microsoft Store o
  [la página oficial de descargas](https://ngrok.com/download/windows).
- Inicia sesión en ngrok y configura el authtoken en tu equipo, sin compartirlo:

  ```powershell
  ngrok config add-authtoken <TU_AUTHTOKEN>
  ngrok version
  ngrok config check
  ```

- Instala las dependencias de cada servicio (`npm install` desde sus carpetas).
- En `auth-service/.env` y `coordinator/.env`, configura la misma `JWT_SECRET`.
- Arranca un servicio por terminal, desde la raíz del repositorio:

  ```powershell
  npm start --prefix auth-service
  npm start --prefix coordinator
  npm start --prefix client
  ```

- Comprueba la disponibilidad local antes de abrir túneles:

  ```powershell
  Invoke-WebRequest http://localhost:4000/health
  Invoke-WebRequest http://localhost:5000/health
  Invoke-WebRequest http://localhost:3000/
  ```

  La ruta `/` del cliente redirige a `/login.html`.

## Abrir los túneles

La sintaxis verificada con ngrok Agent `3.39.9-msix-stable` es `ngrok http
[address:port]`; se puede consultar con `ngrok http --help`. Ejecuta cada comando
en una terminal separada:

```powershell
ngrok http 4000
ngrok http 5000
ngrok http 3000
```

Asocia cada URL HTTPS publicada al servicio correspondiente:

| Servicio | Puerto local | URL pública que se debe configurar |
|---|---:|---|
| Auth | 4000 | `https://<url-auth-asignada>` |
| Coordinador | 5000 | `https://<url-coordinador-asignada>` |
| Cliente | 3000 | `https://<url-cliente-asignada>` |

Las tres URLs deben ser **distintas**. Si la cuenta o el plan no permite iniciar
tres endpoints independientes, revisa en el dashboard de ngrok qué dominios o
endpoints están disponibles para esa cuenta. No reutilices una URL para varios
puertos: los clientes no tendrían tres destinos inequívocos.

La sintaxis verificada para iniciar endpoints definidos en un archivo de
configuración es `ngrok start --all`. La configuración actual de ngrok usa
versionado `3` y definiciones `endpoints`; cada endpoint necesita una URL. Usa
esta alternativa solo después de disponer de tres URLs distintas y validar el
archivo con `ngrok config check`. No añadas authtoken al archivo que se versiona.

## Variables de entorno para URLs públicas

Después de confirmar las tres URLs asignadas, actualiza los `.env` locales.
No agregues barra al final de las URLs:

```dotenv
# client/.env
PORT=3000
AUTH_URL=https://<url-auth-asignada>
COORDINATOR_WS_URL=wss://<url-coordinador-asignada>
```

```dotenv
# auth-service/.env
CORS_ORIGINS=http://localhost:3000,https://<url-cliente-asignada>
```

`coordinator/.env` normalmente no requiere cambios: conserva `PORT` y la misma
`JWT_SECRET` que Auth. Reinicia Auth, Coordinador y Cliente para cargar sus
respectivos `.env`. En el navegador, recarga el cliente y comprueba
`/config.js`; el cliente debe mostrar `AUTH_URL` con `https://` y
`COORDINATOR_WS_URL` con `wss://`.

## Pruebas públicas

Usa las URLs reales solo en la terminal, Thunder Client y el navegador; no las
pegues en archivos versionados:

```powershell
Invoke-RestMethod https://<url-auth-asignada>/health
Invoke-RestMethod https://<url-coordinador-asignada>/health
Invoke-WebRequest https://<url-cliente-asignada>/
```

Desde la URL pública del cliente, registra un usuario, inicia sesión y confirma
que el lobby conecta por `wss://`. Repite la prueba con un segundo navegador o
dispositivo y confirma que las listas se actualizan en ambos sin recargar.
Thunder Client debe probar `POST /register` y `POST /login` contra la URL
pública de Auth. Para probar el endpoint WebSocket público, usa un token de
prueba recién emitido:

```powershell
wscat -c "wss://<url-coordinador-asignada>/connect?token=<TOKEN>"
```

No guardes ni publiques ese token.

## Diagnóstico

- **CORS o preflight fallido:** agrega el origen HTTPS exacto del cliente a
  `CORS_ORIGINS` en `auth-service/.env` y reinicia Auth. El middleware de Auth
  debe permitir `Content-Type` y `ngrok-skip-browser-warning`.
- **Mixed content o WebSocket bloqueado:** con una página HTTPS usa `https://`
  para Auth y `wss://` para el Coordinador; no uses `http://` ni `ws://`.
- **Intersticial de ngrok:** el cliente añade
  `ngrok-skip-browser-warning: true` a sus peticiones HTTP.
- **Cierre 4001 al conectar:** comprueba que Auth y Coordinador tengan la misma
  `JWT_SECRET` y que el token no esté vencido.
- **502 o ERR_NGROK:** confirma que el servicio local está escuchando en el
  puerto correspondiente y que ngrok apunta a ese puerto.
- **Una misma URL pública para varios túneles:** no configures esa URL en los
  `.env`; revisa las asignaciones de dominios/endpoints del plan de ngrok antes
  de continuar.

## Verificación de esta fase

En la ejecución local de Fase 4, los tres comandos `ngrok http 4000`,
`ngrok http 5000` y `ngrok http 3000` iniciaron, pero cada inspector local
reportó la misma URL pública para un upstream distinto. Se detuvieron las tres
sesiones para no dejar una URL ambigua apuntando a servicios diferentes. Por
esto aún no se completaron las pruebas públicas de Auth, Coordinador, lobby,
CORS, `wscat`, ni registro/login por ngrok. Se deben repetir cuando la cuenta
disponga de tres URLs distintas.

En el plan gratuito, las URLs asignadas pueden cambiar al reiniciar los
túneles. Si cambian, actualiza `client/.env` y `auth-service/.env`, reinicia
los tres servicios y vuelve a probar el flujo antes de la sustentación. Mantén
los tres túneles activos durante la demostración.
