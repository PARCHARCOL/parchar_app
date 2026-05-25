const SESSION_KEY =
  "parchar_client_session";

const registerForm =
  document.querySelector(
    "#client-register-form"
  );

const loginForm =
  document.querySelector(
    "#client-login-form"
  );

const authSection =
  document.querySelector(
    "#client-auth-section"
  );

const authMessage =
  document.querySelector(
    "#client-auth-message"
  );

const businessSection =
  document.querySelector(
    "#business-section"
  );

const sessionLabel =
  document.querySelector(
    "#client-session-label"
  );

const sessionUser =
  document.querySelector(
    "#client-session-user"
  );

const logoutButton =
  document.querySelector(
    "#client-logout"
  );

const businessForm =
  document.querySelector(
    "#business-form"
  );

const businessMessage =
  document.querySelector(
    "#business-message"
  );

const videoInput =
  document.querySelector(
    "#video-input"
  );

const videoStatus =
  document.querySelector(
    "#video-status"
  );

const videoDurationInput =
  document.querySelector(
    "#video-duration-seconds"
  );

const useLocationButton =
  document.querySelector(
    "#use-location"
  );

let currentToken = "";
let currentClient = null;

function setMessage(
  element,
  text,
  isError = false
) {
  if (!element) {
    return;
  }

  element.textContent = text;

  element.classList.toggle(
    "error",
    isError
  );

  element.classList.toggle(
    "success",
    !isError
  );
}

function saveSession(
  token,
  client
) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token,
      client,
    })
  );
}

function clearSession() {
  localStorage.removeItem(
    SESSION_KEY
  );
  currentToken = "";
  currentClient = null;
}

function loadSession() {
  try {
    const raw =
      localStorage.getItem(
        SESSION_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed?.token ||
      !parsed?.client
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setBusinessFormClientData(
  client
) {
  if (!businessForm) {
    return;
  }

  const ownerNameInput =
    businessForm.querySelector(
      "input[name='ownerName']"
    );

  const ownerEmailInput =
    businessForm.querySelector(
      "input[name='ownerEmail']"
    );

  const ownerPhoneInput =
    businessForm.querySelector(
      "input[name='ownerPhone']"
    );

  ownerNameInput.value =
    client.fullName;
  ownerEmailInput.value =
    client.email;
  ownerPhoneInput.value =
    client.phone;
}

function showLoggedOutState() {
  authSection.style.display =
    "block";
  businessSection.style.display =
    "none";
  setMessage(
    authMessage,
    "Inicia sesion para publicar tu negocio.",
    false
  );
}

function showLoggedInState() {
  authSection.style.display =
    "none";
  businessSection.style.display =
    "block";

  sessionLabel.textContent =
    "Sesion activa";

  sessionUser.textContent = `${currentClient.fullName} (${currentClient.email})`;

  setBusinessFormClientData(
    currentClient
  );
}

async function apiRequest(
  url,
  options = {}
) {
  const headers = new Headers(
    options.headers || {}
  );

  if (
    currentToken &&
    !headers.has(
      "Authorization"
    )
  ) {
    headers.set(
      "Authorization",
      `Bearer ${currentToken}`
    );
  }

  const response = await fetch(
    url,
    {
      ...options,
      headers,
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Error en la solicitud."
    );
  }

  return data;
}

async function bootstrapSession() {
  const session =
    loadSession();

  if (!session) {
    showLoggedOutState();
    return;
  }

  currentToken =
    session.token;

  try {
    const data =
      await apiRequest(
        "/api/clients/me"
      );

    currentClient =
      data.client;
    saveSession(
      currentToken,
      currentClient
    );
    showLoggedInState();
  } catch {
    clearSession();
    showLoggedOutState();
  }
}

registerForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    setMessage(
      authMessage,
      "Creando cuenta cliente..."
    );

    const payload =
      Object.fromEntries(
        new FormData(
          registerForm
        ).entries()
      );

    try {
      await apiRequest(
        "/api/clients/register",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      registerForm.reset();
      setMessage(
        authMessage,
        "Cuenta creada. Ahora inicia sesion.",
        false
      );
    } catch (error) {
      setMessage(
        authMessage,
        error.message,
        true
      );
    }
  }
);

loginForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    setMessage(
      authMessage,
      "Iniciando sesion..."
    );

    const payload =
      Object.fromEntries(
        new FormData(
          loginForm
        ).entries()
      );

    try {
      const data =
        await apiRequest(
          "/api/clients/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              payload
            ),
          }
        );

      currentToken =
        data.token;
      currentClient =
        data.client;

      saveSession(
        currentToken,
        currentClient
      );

      loginForm.reset();
      showLoggedInState();
      setMessage(
        businessMessage,
        "Sesion activa. Ya puedes publicar tu negocio.",
        false
      );
    } catch (error) {
      setMessage(
        authMessage,
        error.message,
        true
      );
    }
  }
);

logoutButton?.addEventListener(
  "click",
  async () => {
    try {
      await apiRequest(
        "/api/clients/logout",
        {
          method: "POST",
        }
      );
    } catch {
      // no-op
    } finally {
      clearSession();
      businessForm.reset();
      videoDurationInput.value =
        "";
      videoStatus.textContent =
        "";
      showLoggedOutState();
    }
  }
);

async function extractVideoDuration(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const tempVideo =
        document.createElement(
          "video"
        );

      tempVideo.preload =
        "metadata";
      tempVideo.muted = true;
      tempVideo.src =
        URL.createObjectURL(file);

      tempVideo.onloadedmetadata =
        () => {
          const seconds =
            tempVideo.duration;

          URL.revokeObjectURL(
            tempVideo.src
          );

          if (
            !Number.isFinite(
              seconds
            )
          ) {
            reject(
              new Error(
                "No pudimos leer la duracion del video."
              )
            );
            return;
          }

          resolve(seconds);
        };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(
          tempVideo.src
        );
        reject(
          new Error(
            "El archivo no parece un video valido."
          )
        );
      };
    }
  );
}

videoInput?.addEventListener(
  "change",
  async () => {
    videoStatus.textContent =
      "";
    videoDurationInput.value =
      "";

    const file =
      videoInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      const seconds =
        await extractVideoDuration(
          file
        );

      const rounded =
        Number(
          seconds.toFixed(2)
        );

      if (
        rounded < 10 ||
        rounded > 13
      ) {
        videoInput.value =
          "";
        setMessage(
          videoStatus,
          `Duracion invalida (${rounded}s). Debe durar entre 10 y 13 segundos.`,
          true
        );
        return;
      }

      videoDurationInput.value =
        String(rounded);

      setMessage(
        videoStatus,
        `Video validado: ${rounded}s.`,
        false
      );
    } catch (error) {
      videoInput.value =
        "";
      setMessage(
        videoStatus,
        error.message,
        true
      );
    }
  }
);

useLocationButton?.addEventListener(
  "click",
  () => {
    if (
      !navigator.geolocation
    ) {
      setMessage(
        businessMessage,
        "Tu navegador no permite geolocalizacion.",
        true
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latInput =
          businessForm.querySelector(
            "input[name='latitude']"
          );

        const lngInput =
          businessForm.querySelector(
            "input[name='longitude']"
          );

        latInput.value =
          position.coords.latitude.toFixed(
            6
          );
        lngInput.value =
          position.coords.longitude.toFixed(
            6
          );

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
  }
);

businessForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!currentToken) {
      setMessage(
        businessMessage,
        "Debes iniciar sesion para publicar.",
        true
      );
      showLoggedOutState();
      return;
    }

    setBusinessFormClientData(
      currentClient
    );

    setMessage(
      businessMessage,
      "Subiendo negocio y documentos..."
    );

    const formData =
      new FormData(
        businessForm
      );

    const duration =
      Number(
        formData.get(
          "videoDurationSeconds"
        )
      );

    if (
      !Number.isFinite(
        duration
      ) ||
      duration < 10 ||
      duration > 13
    ) {
      setMessage(
        businessMessage,
        "Debes subir un video valido entre 10 y 13 segundos.",
        true
      );
      return;
    }

    try {
      await apiRequest(
        "/api/businesses",
        {
          method: "POST",
          body: formData,
        }
      );

      businessForm.reset();
      setBusinessFormClientData(
        currentClient
      );
      videoDurationInput.value =
        "";
      videoStatus.textContent =
        "";

      setMessage(
        businessMessage,
        "Negocio enviado para revision correctamente.",
        false
      );
    } catch (error) {
      setMessage(
        businessMessage,
        error.message,
        true
      );
    }
  }
);

bootstrapSession();
