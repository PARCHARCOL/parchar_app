const adBanner = document.querySelector(".ad-banner");

function readStoredClient() {
  try {
    const raw = localStorage.getItem(
      "parchar_client_session"
    );
    const parsed = JSON.parse(raw || "{}");
    return parsed.client || null;
  } catch {
    return null;
  }
}

function setAdFeedback(
  element,
  message,
  isError = false
) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle(
    "error",
    isError
  );
  element.classList.toggle(
    "success",
    Boolean(message) && !isError
  );
}

function ensureAdModal() {
  let modal = document.querySelector(
    "#ad-request-modal"
  );

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "ad-request-modal";
  modal.className = "ad-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="ad-modal-card" role="dialog" aria-modal="true" aria-labelledby="ad-request-title">
      <div class="ad-modal-head">
        <h2 id="ad-request-title">Solicitar pauta</h2>
        <button type="button" class="icon-ghost ad-close" aria-label="Cerrar" data-ad-close>&times;</button>
      </div>

      <p>
        Dejanos tus datos y el equipo de Parchar te contactara para activar publicidad.
      </p>

      <form id="ad-request-form" class="form-grid">
        <label>
          Nombre
          <input name="fullName" required />
        </label>

        <label>
          Negocio o marca
          <input name="businessName" required />
        </label>

        <label>
          Telefono
          <input name="phone" />
        </label>

        <label>
          Correo
          <input name="email" type="email" />
        </label>

        <label class="full-row">
          Mensaje
          <textarea name="message" rows="3" required>Quiero recibir informacion para pautar publicidad en Parchar.</textarea>
        </label>

        <button type="submit" class="submit-btn">Enviar solicitud</button>
        <button type="button" class="ghost-btn" data-ad-close>Cerrar</button>
      </form>

      <p id="ad-request-feedback" class="feedback"></p>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (
      event.target === modal ||
      event.target.closest("[data-ad-close]")
    ) {
      modal.hidden = true;
    }
  });

  const form = modal.querySelector(
    "#ad-request-form"
  );
  const feedback = modal.querySelector(
    "#ad-request-feedback"
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAdFeedback(
      feedback,
      "Enviando solicitud..."
    );

    const formData = new FormData(form);
    const payload = Object.fromEntries(
      formData.entries()
    );
    payload.sourcePage =
      window.location.pathname +
      window.location.search;

    try {
      const response = await fetch(
        "/api/ads/requests",
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
      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo enviar la solicitud."
        );
      }

      form.reset();
      setAdFeedback(
        feedback,
        data.message ||
          "Solicitud enviada correctamente."
      );
    } catch (error) {
      setAdFeedback(
        feedback,
        error.message,
        true
      );
    }
  });

  return modal;
}

function openAdRequestModal() {
  const modal = ensureAdModal();
  const form = modal.querySelector(
    "#ad-request-form"
  );
  const feedback = modal.querySelector(
    "#ad-request-feedback"
  );
  const client = readStoredClient();

  setAdFeedback(
    feedback,
    ""
  );

  if (client && form) {
    form.elements.fullName.value =
      client.fullName || "";
    form.elements.email.value =
      client.email || "";
    form.elements.phone.value =
      client.phone || "";
  }

  modal.hidden = false;
  form?.elements.businessName?.focus();
}

async function loadAdBanner() {
  if (!adBanner) {
    return;
  }

  document.body.classList.add(
    "ad-disabled"
  );
  adBanner.hidden = true;

  try {
    const response = await fetch(
      "/api/ads/banner"
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo cargar publicidad."
      );
    }

    const banner =
      data.banner || {};

    if (!banner.enabled) {
      return;
    }

    const pill =
      adBanner.querySelector(
        ".ad-pill"
      );
    const text =
      adBanner.querySelector("p");
    const button =
      adBanner.querySelector(
        ".ad-cta"
      );

    if (pill) {
      pill.textContent =
        banner.title || "Publicidad";
    }

    if (text) {
      text.textContent =
        banner.message ||
        "Espacio para aliados de Parchar";
    }

    if (button) {
      button.textContent =
        banner.ctaLabel || "Anunciar";
      button.addEventListener(
        "click",
        openAdRequestModal
      );
    }

    document.body.classList.remove(
      "ad-disabled"
    );
    adBanner.hidden = false;
  } catch {
    adBanner.hidden = true;
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    loadAdBanner
  );
} else {
  loadAdBanner();
}
