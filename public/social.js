const socialFeed = document.querySelector("#social-feed");
const PARCHAR_VISITOR_KEY =
  "parchar_visitor_key";
const REPORT_REASONS = [
  "Contenido sexual o pornografico",
  "Violencia o amenaza",
  "Menor en situacion sensible",
  "Insultos o acoso",
  "Datos privados",
  "No corresponde al local",
  "Otro",
];

let fallbackVisitorKey = "";
let reportReviewId = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function getVisitorKey() {
  try {
    let key =
      localStorage.getItem(
        PARCHAR_VISITOR_KEY
      );

    if (!key) {
      key = `${
        Date.now()
      }-${Math.random()
        .toString(16)
        .slice(2)}`;
      localStorage.setItem(
        PARCHAR_VISITOR_KEY,
        key
      );
    }

    return key;
  } catch {
    if (!fallbackVisitorKey) {
      fallbackVisitorKey = `temp-${
        Date.now()
      }-${Math.random()
        .toString(16)
        .slice(2)}`;
    }

    return fallbackVisitorKey;
  }
}

function setReportStatus(
  message,
  isError = false
) {
  const status =
    document.querySelector(
      "#report-status"
    );

  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle(
    "error",
    isError
  );
  status.classList.toggle(
    "success",
    Boolean(message) && !isError
  );
}

function closeReportModal() {
  const modal =
    document.querySelector(
      "#report-modal"
    );

  if (modal) {
    modal.hidden = true;
  }
}

function ensureReportModal() {
  let modal = document.querySelector(
    "#report-modal"
  );

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "report-modal";
  modal.className = "ad-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="ad-modal-card report-modal-card" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div class="ad-modal-head">
        <h2 id="report-title">Denunciar resena</h2>
        <button type="button" class="icon-ghost ad-close" aria-label="Cerrar" data-report-close>&times;</button>
      </div>
      <p>Esta alerta llega al equipo de Parchar para revisar el video y retirarlo si incumple normas.</p>
      <form id="report-form" class="report-form">
        <label>
          Motivo
          <select name="reason" required>
            <option value="">Selecciona una opcion</option>
            ${REPORT_REASONS.map(
              (reason) => `
                <option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>
              `
            ).join("")}
          </select>
        </label>
        <label>
          Detalle opcional
          <textarea name="details" rows="3" maxlength="500" placeholder="Agrega contexto si hace falta"></textarea>
        </label>
        <p id="report-status" class="status-muted"></p>
        <div class="review-actions">
          <button type="submit" class="submit-btn">Enviar denuncia</button>
          <button type="button" class="ghost-btn" data-report-close>Cerrar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener(
    "click",
    (event) => {
      if (
        event.target === modal ||
        event.target.closest(
          "[data-report-close]"
        )
      ) {
        closeReportModal();
      }
    }
  );

  modal
    .querySelector("#report-form")
    ?.addEventListener(
      "submit",
      sendReport
    );

  return modal;
}

function openReportModal(reviewId) {
  reportReviewId = reviewId;
  const modal = ensureReportModal();
  const form =
    modal.querySelector(
      "#report-form"
    );

  if (form) {
    form.reset();
  }

  setReportStatus("");
  modal.hidden = false;
}

async function sendReport(event) {
  event.preventDefault();

  if (!reportReviewId) {
    setReportStatus(
      "No se pudo identificar la resena.",
      true
    );
    return;
  }

  const form = event.currentTarget;
  const formData =
    new FormData(form);
  const reason = String(
    formData.get("reason") || ""
  ).trim();
  const details = String(
    formData.get("details") || ""
  ).trim();

  if (!reason) {
    setReportStatus(
      "Selecciona un motivo.",
      true
    );
    return;
  }

  setReportStatus(
    "Enviando denuncia..."
  );

  try {
    const response = await fetch(
      `/api/social/reviews/${reportReviewId}/report`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          visitorKey:
            getVisitorKey(),
          reason,
          details,
        }),
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo enviar la denuncia."
      );
    }

    setReportStatus(
      data.message ||
        "Denuncia enviada.",
      false
    );
    setTimeout(
      closeReportModal,
      900
    );
  } catch (error) {
    setReportStatus(
      error.message,
      true
    );
  }
}

function renderSocial(items) {
  if (!socialFeed) {
    return;
  }

  if (!items.length) {
    socialFeed.innerHTML = `
      <article class="empty-card">
        <h3>No hay resenas activas</h3>
        <p>Cuando alguien parcha un local y graba una resena, aparecera aqui durante 15 dias.</p>
      </article>
    `;
    return;
  }

  socialFeed.innerHTML = items
    .map(
      (item) => `
        <article class="social-card">
          <header>
            <div>
              <span class="chip">${escapeHtml(item.category)}</span>
              <h3>${escapeHtml(item.business_name)}</h3>
              <p>${escapeHtml(item.city)} - ${escapeHtml(item.address)}</p>
            </div>
            <div class="social-parches">
              <strong>${escapeHtml(item.parchar_count || 0)}</strong>
              <span>Parchar</span>
            </div>
          </header>

          <video controls preload="metadata" src="${escapeHtml(item.video_path)}"></video>

          <p class="tiny">
            Publicada: ${escapeHtml(formatDate(item.created_at))} - Activa hasta: ${escapeHtml(formatDate(item.expires_at))}
          </p>

          <div class="social-actions">
            <button type="button" class="ghost-btn report-review-btn" data-report-review="${escapeHtml(item.id)}">
              Denunciar
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadSocial() {
  try {
    const response = await fetch("/api/social/reviews");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo cargar el muro.");
    }

    renderSocial(data.items || []);
  } catch (error) {
    socialFeed.innerHTML = `
      <article class="empty-card">
        <h3>No pudimos cargar el muro</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

socialFeed?.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-report-review]"
      );

    if (!button) {
      return;
    }

    openReportModal(
      button.dataset.reportReview
    );
  }
);

loadSocial();
