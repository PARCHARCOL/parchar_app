import React, { useEffect, useRef, useState, useMemo } from "react";
import Panzoom from "@panzoom/panzoom";
import { Plus, Minus, Scan, Focus } from "lucide-react";
import { BOARD, TOPICS, islandOrigin } from "./domain";
import PostNode from "./PostNode";
export default function SpatialCanvas({
  nodes,
  topic,
  focusRequest,
  onOpen,
  visited,
  onCreate,
  cameraRef,
  now,
}) {
  const viewport = useRef(null),
    board = useRef(null),
    panzoom = useRef(null),
    gesture = useRef({ moved: false }),
    [camera, setCamera] = useState(
      cameraRef.current || { x: 0, y: 0, scale: 1 },
    ),
    [size, setSize] = useState({ width: 1, height: 1 });
  const focusRef = useRef(() => {}),
    topicRef = useRef(topic);
  topicRef.current = topic;
  useEffect(() => {
    const host = viewport.current,
      element = board.current,
      saved = cameraRef.current ? { ...cameraRef.current } : null,
      origin = islandOrigin(
        Math.max(
          0,
          TOPICS.findIndex((t) => t.id === topicRef.current),
        ),
      ),
      w = host.clientWidth,
      h = host.clientHeight,
      s = w < 370 ? (w - 32) / 330 : 1,
      ox = w < 700 ? (w - 310 * s) / 2 : 24;
    const initial = saved || {
      scale: s,
      x: (ox - (BOARD.width / 2) * (1 - s)) / s - origin.x,
      y: (24 - (BOARD.height / 2) * (1 - s)) / s - origin.y,
    };
    const pz = Panzoom(element, {
      canvas: true,
      minScale: 0.08,
      maxScale: 1.8,
      step: 0.24,
      pinchAndPan: true,
      startX: initial.x,
      startY: initial.y,
      startScale: initial.scale,
      handleStartEvent: (event) => {
        event.preventDefault();
      },
    });
    panzoom.current = pz;
    let frame,
      initialized = false;
    const update = () => {
      if (!initialized) return;
      // Panzoom events arrive on animation frames; a prior zoom may already be obsolete.
      const value = { ...pz.getPan(), scale: pz.getScale() },
        s = value.scale,
        w = host.clientWidth,
        h = host.clientHeight;
      // Clamp to the finite edition, keeping a small edge margin rather than an endless blank canvas.
      const ox = (BOARD.width / 2) * (1 - s) + value.x * s,
        oy = (BOARD.height / 2) * (1 - s) + value.y * s;
      const cx =
          BOARD.width * s < w
            ? (w - BOARD.width * s) / 2
            : Math.max(w - BOARD.width * s - 40, Math.min(40, ox)),
        cy =
          BOARD.height * s < h
            ? (h - BOARD.height * s) / 2
            : Math.max(h - BOARD.height * s - 40, Math.min(40, oy));
      if (Math.abs(cx - ox) > 0.6 || Math.abs(cy - oy) > 0.6) {
        pz.pan(
          (cx - (BOARD.width / 2) * (1 - s)) / s,
          (cy - (BOARD.height / 2) * (1 - s)) / s,
          { force: true },
        );
        return;
      }
      cameraRef.current = { x: value.x, y: value.y, scale: s };
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setCamera({ ...cameraRef.current });
        setSize({ width: w, height: h });
      });
    };
    element.addEventListener("panzoomchange", update);
    const focusIsland = () => {
      const origin = islandOrigin(
          Math.max(
            0,
            TOPICS.findIndex((t) => t.id === topicRef.current),
          ),
        ),
        w = host.clientWidth,
        h = host.clientHeight,
        s = w < 370 ? (w - 32) / 330 : 1;
      const offsetX = w < 700 ? (w - 310 * s) / 2 : 24,
        offsetY = 24;
      pz.zoom(s, { animate: false });
      pz.pan(
        (offsetX - (BOARD.width / 2) * (1 - s)) / s - origin.x,
        (offsetY - (BOARD.height / 2) * (1 - s)) / s - origin.y,
        { animate: false, force: true },
      );
    };
    focusRef.current = focusIsland;
    const resize = new ResizeObserver(() => {
      setSize({ width: host.clientWidth, height: host.clientHeight });
    });
    resize.observe(host);
    const initialTimer = setTimeout(() => {
      initialized = true;
      update({ detail: { ...pz.getPan(), scale: pz.getScale() } });
    }, 0);
    const wheel = (e) => pz.zoomWithWheel(e);
    host.addEventListener("wheel", wheel, { passive: false });
    return () => {
      resize.disconnect();
      host.removeEventListener("wheel", wheel);
      element.removeEventListener("panzoomchange", update);
      clearTimeout(initialTimer);
      if (frame) cancelAnimationFrame(frame);
      pz.destroy();
    };
  }, []);
  const lastFocus = useRef(focusRequest);
  useEffect(() => {
    if (lastFocus.current !== focusRequest) {
      lastFocus.current = focusRequest;
      focusRef.current();
    }
  }, [focusRequest]);
  const visible = useMemo(() => {
    const ox = (BOARD.width / 2) * (1 - camera.scale) + camera.x * camera.scale,
      oy = (BOARD.height / 2) * (1 - camera.scale) + camera.y * camera.scale;
    return nodes.filter(
      (p) =>
        (p.x + p.width) * camera.scale + ox > -400 &&
        p.x * camera.scale + ox < size.width + 400 &&
        (p.y + p.height) * camera.scale + oy > -350 &&
        p.y * camera.scale + oy < size.height + 350,
    );
  }, [nodes, camera, size]);
  const overview = () => {
    const host = viewport.current,
      s = Math.min(
        (host.clientWidth - 24) / BOARD.width,
        (host.clientHeight - 24) / BOARD.height,
      );
    panzoom.current.zoom(s, { animate: false });
    panzoom.current.pan(
      (host.clientWidth - BOARD.width) / 2 / s,
      (host.clientHeight - BOARD.height) / 2 / s,
      { force: true, animate: false },
    );
  };
  return (
    <div
      ref={viewport}
      className="sw-canvas"
      tabIndex="0"
      aria-label="Mapa de publicaciones"
      onKeyDown={(e) => {
        if (e.target !== viewport.current) return;
        const pz = panzoom.current,
          p = pz.getPan();
        if (e.key === "+") pz.zoomIn();
        else if (e.key === "-") pz.zoomOut();
        else if (e.key === "Home") focusRef.current();
        else if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
          e.preventDefault();
          pz.pan(
            p.x +
              (e.key === "ArrowLeft" ? 120 : e.key === "ArrowRight" ? -120 : 0),
            p.y +
              (e.key === "ArrowUp" ? 120 : e.key === "ArrowDown" ? -120 : 0),
          );
        }
      }}
      onPointerDownCapture={(e) => {
        gesture.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMoveCapture={(e) => {
        if (e.buttons || e.pointerType === "touch")
          if (
            Math.hypot(
              e.clientX - gesture.current.x,
              e.clientY - gesture.current.y,
            ) > 7
          )
            gesture.current.moved = true;
      }}
      onClickCapture={(e) => {
        if (
          e.detail !== 0 &&
          gesture.current.moved &&
          e.target.closest("[data-node]")
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div
        ref={board}
        className="sw-board"
        style={{ width: BOARD.width, height: BOARD.height }}
      >
        {TOPICS.map((t, i) => {
          const origin = islandOrigin(i);
          return (
            <section
              key={t.id}
              className="sw-island"
              style={{
                left: origin.x,
                top: origin.y,
                "--island-color": t.color,
              }}
              aria-label={t.name}
            >
              <span className="sw-island-number">0{i + 1}</span>
              <h2>{t.name}</h2>
              <p>{t.short}</p>
            </section>
          );
        })}
        {visible.map((post) => (
          <PostNode
            key={post.id}
            post={post}
            visited={visited.has(post.id)}
            onOpen={onOpen}
            now={now}
          />
        ))}
      </div>
      <div className="sw-map-tools panzoom-exclude">
        <button
          className="sw-icon"
          aria-label="Alejar"
          title="Alejar"
          onClick={() => panzoom.current.zoomOut()}
        >
          <Minus size={20} />
        </button>
        <button
          className="sw-icon"
          aria-label="Acercar"
          title="Acercar"
          onClick={() => panzoom.current.zoomIn()}
        >
          <Plus size={20} />
        </button>
        <button
          className="sw-icon"
          aria-label="Ver toda la edición"
          title="Ver toda la edición"
          onClick={overview}
        >
          <Scan size={20} />
        </button>
        <button
          className="sw-icon"
          aria-label="Volver a la isla"
          title="Volver a la isla"
          onClick={() => focusRef.current()}
        >
          <Focus size={20} />
        </button>
      </div>
      <button className="sw-create panzoom-exclude" onClick={onCreate}>
        <Plus size={21} />
        <span>Nuevo nodo</span>
      </button>
    </div>
  );
}
