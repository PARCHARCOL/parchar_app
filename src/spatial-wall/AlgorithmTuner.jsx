import React, { useEffect, useRef } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { CITIES } from "./domain";
export default function AlgorithmTuner({
  filters,
  onChange,
  open,
  setOpen,
  period,
  setPeriod,
}) {
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const key = (e) => {
        if (e.key === "Escape") setOpen(false);
      },
      outside = (e) => {
        if (!root.current?.contains(e.target)) setOpen(false);
      };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, setOpen]);
  return (
    <div className="sw-tuner" ref={root}>
      <div className="sw-editions" role="group" aria-label="Edición del muro">
        {[
          ["morning", "Mañana"],
          ["night", "Noche"],
          ["archive", "Joyas"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={period === id}
            onClick={() => setPeriod(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`sw-icon ${open ? "is-active" : ""}`}
        aria-expanded={open}
        aria-controls="sw-filters"
        aria-label="Ajustar cercanía y profundidad"
        title="Ajustar cercanía y profundidad"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={20} />
      </button>
      {open && (
        <section
          className="sw-filter-panel"
          id="sw-filters"
          aria-label="Ajustes del muro"
        >
          <div className="flex items-center justify-between">
            <h2>Tu edición</h2>
            <button
              type="button"
              className="sw-icon"
              aria-label="Cerrar ajustes"
              title="Cerrar ajustes"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <label>
            Municipio
            <select
              aria-label="Municipio"
              value={filters.city}
              onChange={(e) => onChange({ ...filters, city: e.target.value })}
            >
              <option value="">Toda la comunidad</option>
              {CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label>
            Cercanía{" "}
            <output>
              {!filters.city
                ? "Comunidad"
                : filters.reach === 0
                  ? "Mi municipio"
                  : filters.reach === 50
                    ? "Área metropolitana"
                    : "Comunidad"}
            </output>
            <input
              aria-label="Cercanía"
              type="range"
              min="0"
              max="100"
              step="50"
              value={filters.reach}
              disabled={!filters.city}
              onChange={(e) =>
                onChange({ ...filters, reach: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Profundidad mínima{" "}
            <output>
              {filters.depth === 0 ? "Todas" : `${filters.depth} / 100`}
            </output>
            <input
              aria-label="Profundidad mínima"
              type="range"
              min="0"
              max="100"
              step="25"
              value={filters.depth}
              onChange={(e) =>
                onChange({ ...filters, depth: Number(e.target.value) })
              }
            />
          </label>
          <button
            type="button"
            className="sw-text-button"
            onClick={() => onChange({ city: "", reach: 100, depth: 0 })}
          >
            Restablecer ajustes
          </button>
        </section>
      )}
    </div>
  );
}
