(() => {
  const fields = document.querySelectorAll('input[type="password"]');
  fields.forEach((input, index) => {
    if (input.dataset.visibilityControl === "ready") return;
    input.dataset.visibilityControl = "ready";
    if (!input.id) input.id = `password-input-${index + 1}`;

    const wrapper = document.createElement("span");
    wrapper.className = "password-input-wrap";
    input.before(wrapper);
    wrapper.appendChild(input);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-visibility-toggle";
    toggle.textContent = "Ver";
    toggle.setAttribute("aria-label", "Mostrar contraseña");
    toggle.setAttribute("aria-controls", input.id);
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      toggle.textContent = showPassword ? "Ocultar" : "Ver";
      toggle.setAttribute(
        "aria-label",
        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
      );
      toggle.setAttribute("aria-pressed", String(showPassword));
      input.focus({ preventScroll: true });
    });
    wrapper.appendChild(toggle);
  });
})();
