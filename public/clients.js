const SESSION_KEY = "parchar_client_session";

const registerForm = document.querySelector("#client-register-form");
const loginForm = document.querySelector("#client-login-form");
const recoverUserForm = document.querySelector("#client-recover-user-form");
const resetPasswordForm = document.querySelector("#client-reset-password-form");

const authSection = document.querySelector("#client-auth-section");
const authMessage = document.querySelector("#client-auth-message");
const recoveryMessage = document.querySelector("#client-recovery-message");
const authTitle = document.querySelector("#client-auth-title");
const authIntro = document.querySelector("#client-auth-intro");
const authViewButtons = document.querySelectorAll("[data-auth-view]");
const authPanels = document.querySelectorAll("[data-auth-panel]");

const businessSection = document.querySelector("#business-section");
const sessionLabel = document.querySelector("#client-session-label");
const sessionUser = document.querySelector("#client-session-user");
const logoutButton = document.querySelector("#client-logout");

const businessForm = document.querySelector("#business-form");
const businessMessage = document.querySelector("#business-message");

const videoInput = document.querySelector("#video-input");
const videoStatus = document.querySelector("#video-status");
const videoDurationInput = document.querySelector("#video-duration-seconds");
const useLocationButton = document.querySelector("#use-location");

const myBusinessesList = document.querySelector("#my-businesses-list");
const refreshMyBusinessesButton = document.querySelector("#refresh-my-businesses");

const VIDEO_MIN_SECONDS = 15;
const VIDEO_MAX_SECONDS = 20;

let currentToken = "";
let currentClient = null;

const AUTH_VIEW_COPY = {
  login: {
    title: "Iniciar sesion",
    intro: "Ingresa para publicar y administrar tus negocios.",
  },
  register: {
    title: "Crear cuenta",
    intro: "Registra tus datos para comenzar a publicar en Parchar.",
  },
  "recover-user": {
    title: "Recordar usuario",
    intro: "Confirma tus datos para consultar el correo de acceso.",
  },
  "reset-password": {
    title: "Cambiar clave",
    intro: "Verifica tu cuenta y define una nueva contrasena.",
  },
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(element, text, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = text || "";
  element.classList.toggle("error", Boolean(text) && isError);
  element.classList.toggle("success", Boolean(text) && !isError);
}

function showAuthView(view) {
  const selectedView = AUTH_VIEW_COPY[view]
    ? view
    : "login";

  authPanels.forEach((panel) => {
    panel.hidden =
      panel.dataset.authPanel !== selectedView;
  });

  authViewButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.authView === selectedView
    );
  });

  if (authTitle) {
    authTitle.textContent =
      AUTH_VIEW_COPY[selectedView].title;
  }

  if (authIntro) {
    authIntro.textContent =
      AUTH_VIEW_COPY[selectedView].intro;
  }

  setMessage(authMessage, "", false);
  setMessage(recoveryMessage, "", false);
}

function saveSession(token, client) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token,
      client,
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  currentToken = "";
  currentClient = null;
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed?.token || !parsed?.client) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setBusinessFormClientData(client) {
  if (!businessForm || !client) {
    return;
  }

  const ownerNameInput = businessForm.querySelector("input[name='ownerName']");
  const ownerEmailInput = businessForm.querySelector("input[name='ownerEmail']");
  const ownerPhoneInput = businessForm.querySelector("input[name='ownerPhone']");

  if (ownerNameInput) ownerNameInput.value = client.fullName || "";
  if (ownerEmailInput) ownerEmailInput.value = client.email || "";
  if (ownerPhoneInput) ownerPhoneInput.value = client.phone || "";
}

function resetBusinessPanel() {
  if (businessForm) {
    businessForm.reset();
  }

  if (videoDurationInput) {
    videoDurationInput.value = "";
  }

  if (videoStatus) {
    videoStatus.textContent = "";
    videoStatus.classList.remove("error", "success");
  }

  if (myBusinessesList) {
    myBusinessesList.innerHTML = "";
  }
}

function showLoggedOutState() {
  if (authSection) {
    authSection.style.display = "block";
  }

  if (businessSection) {
    businessSection.style.display = "none";
  }

  showAuthView("login");
  setMessage(authMessage, "Inicia sesion para publicar tu negocio.", false);
  setMessage(recoveryMessage, "", false);
  setMessage(businessMessage, "", false);
}

authViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showAuthView(button.dataset.authView);
  });
});

async function showLoggedInState() {
  if (authSection) {
    authSection.style.display = "none";
  }

  if (businessSection) {
    businessSection.style.display = "block";
  }

  if (sessionLabel) {
    sessionLabel.textContent = "Sesion activa";
  }

  if (sessionUser && currentClient) {
    sessionUser.textContent = `${currentClient.fullName} (${currentClient.email})`;
  }

  setBusinessFormClientData(currentClient);
  await loadMyBusinesses();
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});

  if (currentToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Error en la solicitud.");
  }

  return data;
}

function statusLabel(status) {
  switch (status) {
    case "activo":
      return "Activo";
    case "pendiente":
      return "Pendiente";
    case "pausado":
      return "Pausado";
    case "rechazado":
      return "Rechazado";
    default:
      return status || "Sin estado";
  }
}

function renderMyBusinesses(items) {
  if (!myBusinessesList) {
    return;
  }

  if (!items?.length) {
    myBusinessesList.innerHTML = `
      <article class="mini-business-card">
        <h4>Aun no tienes locales publicados</h4>
        <p>Cuando registres tu primer negocio aparecera aqui.</p>
      </article>
    `;
    return;
  }

  myBusinessesList.innerHTML = items
    .map(
      (item) => `
        <article class="mini-business-card">
          <div class="mini-business-head">
            <h4>${escapeHtml(item.business_name)}</h4>
            <span class="status-pill status-${escapeHtml(item.status)}">${escapeHtml(
              statusLabel(item.status)
            )}</span>
          </div>
          <p><strong>Categoria:</strong> ${escapeHtml(item.category)}</p>
          <p><strong>Ciudad:</strong> ${escapeHtml(item.city)}</p>
          ${
            item.video_path
              ? `<a href="${escapeHtml(
                  item.video_path
                )}" class="ghost-btn" target="_blank" rel="noopener noreferrer">Ver video</a>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

async function loadMyBusinesses() {
  if (!currentToken || !myBusinessesList) {
    return;
  }

  myBusinessesList.innerHTML = `
    <article class="mini-business-card">
      <h4>Cargando...</h4>
      <p>Consultando tus locales vinculados.</p>
    </article>
  `;

  try {
    const data = await apiRequest("/api/clients/businesses");
    renderMyBusinesses(data.items || []);
  } catch (error) {
    myBusinessesList.innerHTML = `
      <article class="mini-business-card">
        <h4>No se pudo cargar</h4>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function bootstrapSession() {
  const session = loadSession();

  if (!session) {
    showLoggedOutState();
    return;
  }

  currentToken = session.token;

  try {
    const data = await apiRequest("/api/clients/me");
    currentClient = data.client;
    saveSession(currentToken, currentClient);
    await showLoggedInState();
  } catch {
    clearSession();
    showLoggedOutState();
  }
}

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  setMessage(authMessage, "Creando cuenta cliente...");
  setMessage(recoveryMessage, "", false);

  const payload = Object.fromEntries(new FormData(registerForm).entries());

  try {
    await apiRequest("/api/clients/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    registerForm.reset();
    showAuthView("login");
    setMessage(authMessage, "Cuenta creada. Ahora inicia sesion.", false);
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  setMessage(authMessage, "Iniciando sesion...");
  setMessage(recoveryMessage, "", false);

  const payload = Object.fromEntries(new FormData(loginForm).entries());

  try {
    const data = await apiRequest("/api/clients/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    currentToken = data.token;
    currentClient = data.client;

    saveSession(currentToken, currentClient);
    loginForm.reset();

    await showLoggedInState();

    setMessage(
      businessMessage,
      "Sesion activa. Ya puedes publicar tu negocio.",
      false
    );
  } catch (error) {
    setMessage(authMessage, error.message, true);
  }
});

recoverUserForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  setMessage(recoveryMessage, "Buscando cuenta...");

  const payload = Object.fromEntries(new FormData(recoverUserForm).entries());

  try {
    const data = await apiRequest("/api/clients/recover-username", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    recoverUserForm.reset();
    setMessage(recoveryMessage, `Tu correo de acceso es: ${data.email}`, false);
  } catch (error) {
    setMessage(recoveryMessage, error.message, true);
  }
});

resetPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  setMessage(recoveryMessage, "Actualizando contrasena...");

  const payload = Object.fromEntries(new FormData(resetPasswordForm).entries());

  try {
    await apiRequest("/api/clients/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    resetPasswordForm.reset();
    showAuthView("login");
    setMessage(
      authMessage,
      "Contrasena actualizada. Ahora inicia sesion con tu nueva clave.",
      false
    );
  } catch (error) {
    setMessage(recoveryMessage, error.message, true);
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    await apiRequest("/api/clients/logout", {
      method: "POST",
    });
  } catch {
    // no-op
  } finally {
    clearSession();
    resetBusinessPanel();
    showLoggedOutState();
  }
});

refreshMyBusinessesButton?.addEventListener("click", async () => {
  await loadMyBusinesses();
});

async function extractVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const tempVideo = document.createElement("video");

    tempVideo.preload = "metadata";
    tempVideo.muted = true;
    tempVideo.src = URL.createObjectURL(file);

    tempVideo.onloadedmetadata = () => {
      const seconds = tempVideo.duration;
      URL.revokeObjectURL(tempVideo.src);

      if (!Number.isFinite(seconds)) {
        reject(new Error("No pudimos leer la duracion del video."));
        return;
      }

      resolve(seconds);
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(tempVideo.src);
      reject(new Error("El archivo no parece un video valido."));
    };
  });
}

videoInput?.addEventListener("change", async () => {
  if (!videoStatus || !videoDurationInput || !videoInput) {
    return;
  }

  videoStatus.textContent = "";
  videoDurationInput.value = "";

  const file = videoInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const seconds = await extractVideoDuration(file);
    const rounded = Number(seconds.toFixed(2));

    if (
      rounded < VIDEO_MIN_SECONDS ||
      rounded > VIDEO_MAX_SECONDS
    ) {
      videoInput.value = "";
      setMessage(
        videoStatus,
        `Duracion invalida (${rounded}s). Debe durar entre ${VIDEO_MIN_SECONDS} y ${VIDEO_MAX_SECONDS} segundos.`,
        true
      );
      return;
    }

    videoDurationInput.value = String(rounded);
    setMessage(videoStatus, `Video validado: ${rounded}s.`, false);
  } catch (error) {
    videoInput.value = "";
    setMessage(videoStatus, error.message, true);
  }
});

useLocationButton?.addEventListener("click", () => {
  if (!navigator.geolocation || !businessForm) {
    setMessage(
      businessMessage,
      "Tu navegador no permite geolocalizacion.",
      true
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latInput = businessForm.querySelector("input[name='latitude']");
      const lngInput = businessForm.querySelector("input[name='longitude']");

      if (latInput) {
        latInput.value = position.coords.latitude.toFixed(6);
      }

      if (lngInput) {
        lngInput.value = position.coords.longitude.toFixed(6);
      }

      setMessage(
        businessMessage,
        "Ubicacion cargada correctamente.",
        false
      );
    },
    () => {
      setMessage(
        businessMessage,
        "No pudimos obtener tu ubicacion.",
        true
      );
    }
  );
});

businessForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentToken || !currentClient) {
    setMessage(businessMessage, "Debes iniciar sesion para publicar.", true);
    showLoggedOutState();
    return;
  }

  setBusinessFormClientData(currentClient);
  setMessage(businessMessage, "Subiendo negocio y documentos...");

  const formData = new FormData(businessForm);
  const duration = Number(formData.get("videoDurationSeconds"));

  if (
    !Number.isFinite(duration) ||
    duration < VIDEO_MIN_SECONDS ||
    duration > VIDEO_MAX_SECONDS
  ) {
    setMessage(
      businessMessage,
      `Debes subir un video valido entre ${VIDEO_MIN_SECONDS} y ${VIDEO_MAX_SECONDS} segundos.`,
      true
    );
    return;
  }

  try {
    await apiRequest("/api/businesses", {
      method: "POST",
      body: formData,
    });

    businessForm.reset();
    setBusinessFormClientData(currentClient);

    if (videoDurationInput) {
      videoDurationInput.value = "";
    }

    if (videoStatus) {
      videoStatus.textContent = "";
      videoStatus.classList.remove("error", "success");
    }

    setMessage(
      businessMessage,
      "Negocio enviado para revision correctamente.",
      false
    );

    await loadMyBusinesses();
  } catch (error) {
    setMessage(businessMessage, error.message, true);
  }
});

bootstrapSession();
