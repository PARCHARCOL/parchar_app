const buttons = document.querySelectorAll(".action-btn");
const statusEl = document.querySelector("#location-status");

function updateStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

function redirectWithCategory(category, coords) {
  const url = new URL("/places.html", window.location.origin);
  url.searchParams.set("category", category);
  if (coords) {
    url.searchParams.set("lat", String(coords.latitude));
    url.searchParams.set("lng", String(coords.longitude));
  }
  window.location.href = url.toString();
}

function handleCategory(route) {
  if (route === "clientes") {
    window.location.href = "/clients.html";
    return;
  }

  if (!navigator.geolocation) {
    updateStatus(
      "No se pudo leer tu ubicacion. Te mostrare sitios generales por categoria."
    );
    redirectWithCategory(route, null);
    return;
  }

  updateStatus("Buscando tu ubicacion para mostrar lugares cercanos...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateStatus("Ubicacion lista. Abriendo resultados...");
      redirectWithCategory(route, position.coords);
    },
    () => {
      updateStatus(
        "No autorizaste ubicacion. Te mostrare sitios generales por categoria."
      );
      redirectWithCategory(route, null);
    },
    {
      enableHighAccuracy: true,
      timeout: 7000,
      maximumAge: 0,
    }
  );
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    const route = button.dataset.route;
    handleCategory(route);
  });
}
