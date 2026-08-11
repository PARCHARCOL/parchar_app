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
const rutInput = document.querySelector("input[name='rutDocument']");
const coordinateInputs = document.querySelectorAll(".coordinate-input");

const videoInput = document.querySelector("#video-input");
const videoStatus = document.querySelector("#video-status");
const videoDurationInput = document.querySelector("#video-duration-seconds");
const useLocationButton = document.querySelector("#use-location");

const myBusinessesList = document.querySelector("#my-businesses-list");
const refreshMyBusinessesButton = document.querySelector("#refresh-my-businesses");
const businessSubmitButton = businessForm?.querySelector("button[type='submit']");
const cancelBusinessEditButton = document.querySelector("#cancel-business-edit");

const VIDEO_MIN_SECONDS = 15;
const VIDEO_MAX_SECONDS = 20;

let currentToken = "";
let currentClient = null;
let currentMyBusinesses = [];
let editingBusinessId = "";

coordinateInputs.forEach((input) => {
  input.addEventListener("focus", () => {
    input.blur();
  });
});

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

function setBusinessFileRequirements(isEditing) {
  if (rutInput) {
    rutInput.required = !isEditing;
  }

  if (videoInput) {
    videoInput.required = !isEditing;
  }
}

function clearVideoStatus() {
  if (videoDurationInput) {
    videoDurationInput.value = "";
  }

  if (videoStatus) {
    videoStatus.textContent = "";
    videoStatus.classList.remove("error", "success");
  }
}

function resetBusinessEditMode() {
  editingBusinessId = "";

  if (businessForm?.elements.businessId) {
    businessForm.elements.businessId.value = "";
  }

  setBusinessFileRequirements(false);

  if (businessSubmitButton) {
    businessSubmitButton.textContent = "Enviar para revision";
  }

  if (cancelBusinessEditButton) {
    cancelBusinessEditButton.hidden = true;
  }
}

function startBusinessEdit(item) {
  if (!businessForm || !item) {
    return;
  }

  editingBusinessId = String(item.id || "");
  businessForm.reset();
  setBusinessFormClientData(currentClient);
  setBusinessFileRequirements(true);
  clearVideoStatus();

  const fields = businessForm.elements;

  if (fields.businessId) fields.businessId.value = editingBusinessId;
  if (fields.ownerDocument) fields.ownerDocument.value = item.owner_document || "";
  if (fields.businessName) fields.businessName.value = item.business_name || "";
  if (fields.category) fields.category.value = item.category || "";
  if (fields.city) fields.city.value = item.city || "";
  if (fields.address) fields.address.value = item.address || "";
  if (fields.socialLink) fields.socialLink.value = item.social_link || "";
  if (fields.description) fields.description.value = item.description || "";
  if (fields.products) fields.products.value = item.products || "";
  if (fields.latitude) fields.latitude.value = item.latitude ?? "";
  if (fields.longitude) fields.longitude.value = item.longitude ?? "";
  if (fields.legalAcceptance) fields.legalAcceptance.checked = true;

  if (businessSubmitButton) {
    businessSubmitButton.textContent = "Guardar cambios";
  }

  if (cancelBusinessEditButton) {
    cancelBusinessEditButton.hidden = false;
  }

  setMessage(
    businessMessage,
    "Editando local. Al guardar, el local vuelve a revision de Parchar.",
    false
  );

  setMessage(
    videoStatus,
    "Modo edicion: si no subes un RUT o video nuevo, se conserva el archivo actual.",
    false
  );

  businessForm.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function resetBusinessPanel() {
  if (businessForm) {
    businessForm.reset();
  }

  resetBusinessEditMode();
  clearVideoStatus();

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

function isPdfFile(file) {
  return Boolean(
    file &&
      (file.type ===
        "application/pdf" ||
        file.name
          ?.toLowerCase()
          .endsWith(".pdf"))
  );
}

function renderMyBusinesses(items) {
  if (!myBusinessesList) {
    return;
  }

  currentMyBusinesses = Array.isArray(items) ? items : [];

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
          <div class="mini-business-actions">
            <button type="button" class="ghost-btn" data-edit-business="${escapeHtml(
              item.id
            )}">Editar</button>
            ${
              item.video_path
                ? `<a href="${escapeHtml(
                    item.video_path
                  )}" class="ghost-btn" target="_blank" rel="noopener noreferrer">Ver video</a>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  myBusinessesList
    .querySelectorAll("[data-edit-business]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const selected = currentMyBusinesses.find(
          (item) => String(item.id) === String(button.dataset.editBusiness)
        );
        startBusinessEdit(selected);
      });
    });
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

cancelBusinessEditButton?.addEventListener("click", () => {
  if (businessForm) {
    businessForm.reset();
    setBusinessFormClientData(currentClient);
  }

  resetBusinessEditMode();
  clearVideoStatus();
  setMessage(businessMessage, "Edicion cancelada.", false);
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

  const formData = new FormData(businessForm);
  const businessId = String(formData.get("businessId") || editingBusinessId || "").trim();
  const isEditing = Boolean(businessId);
  const duration = Number(formData.get("videoDurationSeconds"));
  const latitudeRaw = String(
    formData.get("latitude") || ""
  ).trim();
  const longitudeRaw = String(
    formData.get("longitude") || ""
  ).trim();
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  const rutFile = rutInput?.files?.[0];
  const videoFile = videoInput?.files?.[0];

  setMessage(
    businessMessage,
    isEditing ? "Guardando cambios del local..." : "Subiendo negocio y RUT..."
  );

  if (
    !latitudeRaw ||
    !longitudeRaw ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    setMessage(
      businessMessage,
      "Primero presiona Usar mi ubicacion actual para cargar latitud y longitud.",
      true
    );
    return;
  }

  if (!isEditing && !isPdfFile(rutFile)) {
    setMessage(
      businessMessage,
      "El RUT debe estar en formato PDF.",
      true
    );
    return;
  }

  if (isEditing && rutFile && !isPdfFile(rutFile)) {
    setMessage(
      businessMessage,
      "El nuevo RUT debe estar en formato PDF.",
      true
    );
    return;
  }

  if (
    (!isEditing || videoFile) &&
    (!Number.isFinite(duration) ||
      duration < VIDEO_MIN_SECONDS ||
      duration > VIDEO_MAX_SECONDS)
  ) {
    setMessage(
      businessMessage,
      `Debes subir un video valido entre ${VIDEO_MIN_SECONDS} y ${VIDEO_MAX_SECONDS} segundos.`,
      true
    );
    return;
  }

  try {
    const url = isEditing
      ? `/api/clients/businesses/${encodeURIComponent(businessId)}/edit`
      : "/api/businesses";

    const data = await apiRequest(url, {
      method: "POST",
      body: formData,
    });

    businessForm.reset();
    resetBusinessEditMode();
    setBusinessFormClientData(currentClient);
    clearVideoStatus();

    setMessage(
      businessMessage,
      data.message || "Negocio enviado para revision correctamente.",
      false
    );

    await loadMyBusinesses();
  } catch (error) {
    setMessage(businessMessage, error.message, true);
  }
});

bootstrapSession();
