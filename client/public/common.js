function getAppConfig() {
    if (!window.APP_CONFIG || !window.APP_CONFIG.AUTH_URL || !window.APP_CONFIG.COORDINATOR_WS_URL) {
        throw new Error("No se pudo cargar la configuración del cliente.");
    }
    return window.APP_CONFIG;
}

async function apiPost(path, body) {
    let response;
    let payload;

    try {
        const { AUTH_URL } = getAppConfig();
        response = await fetch(`${AUTH_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true"
            },
            body: JSON.stringify(body)
        });
        payload = await response.json();
    } catch {
        return { ok: false, valid: false, networkError: true };
    }

    if (!payload || typeof payload !== "object" || typeof payload.message !== "string") {
        return { ok: false, valid: false, status: response.status };
    }

    if (response.ok && payload.ok === true) {
        return { ok: true, valid: true, status: response.status, payload };
    }

    if (
        payload.ok === false &&
        typeof payload.code === "string" &&
        typeof payload.hint === "string"
    ) {
        return { ok: false, valid: true, status: response.status, payload };
    }

    return { ok: false, valid: false, status: response.status };
}

function getToken() {
    return localStorage.getItem("token");
}

function setCredentials(token, username) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
}

function clearCredentials() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
}
