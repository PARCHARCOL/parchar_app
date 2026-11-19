import React, { useState, useEffect, useMemo, useReducer, useRef } from "react";
import {
  ArrowLeft,
  Sun,
  Moon,
  RefreshCw,
  LayoutList,
  Map,
  Bookmark,
  UserRound,
  Check,
  X,
  LogIn,
  FlaskConical,
} from "lucide-react";
import {
  TOPICS,
  editionPeriod,
  api,
  session,
  readLocal,
  saveLocal,
  layoutPosts,
  filterPosts,
  nodeReducer,
} from "./domain";
import rules from "../../lib/spatial-rules";
import { makeExamples, exampleNotes } from "./mockData";
import SpatialCanvas from "./SpatialCanvas";
import PostNode from "./PostNode";
import AlgorithmTuner from "./AlgorithmTuner";
import NodeDetailModal from "./NodeDetailModal";
import CreateNodeModal from "./CreateNodeModal";

export default function App() {
  const [period, setPeriod] = useState(editionPeriod),
    [theme, setTheme] = useState(() =>
      readLocal("parchar_spatial_theme_v1", "light"),
    ),
    [topic, setTopic] = useState("planes"),
    [focusRequest, setFocusRequest] = useState(0),
    [filters, setFilters] = useState({ city: "", reach: 100, depth: 0 }),
    [tuner, setTuner] = useState(false),
    [listMode, setListMode] = useState(false),
    [view, setView] = useState("map");
  const [user, setUser] = useState(session),
    [data, setData] = useState({ items: [], edition: null }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(
      () => new URLSearchParams(location.search).get("example") === "1",
    ),
    [revision, setRevision] = useState(0),
    [now, setNow] = useState(Date.now),
    [selected, setSelected] = useState(null),
    [notes, setNotes] = useState([]),
    [detailNotice, setDetailNotice] = useState(""),
    [create, setCreate] = useState(
      () => new URLSearchParams(location.search).get("editor") === "1",
    ),
    [toast, setToast] = useState("");
  const [personal, setPersonal] = useState({
      signals: [],
      capsules: [],
      thanks: {},
    }),
    [mine, setMine] = useState([]),
    [exampleCreations, setExampleCreations] = useState(() =>
      readLocal("parchar_spatial_examples_v1", []),
    ),
    [demoSignals, setDemoSignals] = useState(() =>
      readLocal("parchar_spatial_demo_signals_v1", []),
    ),
    [demoNotes, setDemoNotes] = useState(() =>
      readLocal("parchar_spatial_demo_notes_v1", []),
    );
  const [visited, dispatchVisited] = useReducer(nodeReducer, []),
    [closedEdition, setClosedEdition] = useState("");
  const sourceChosen = useRef(
      new URLSearchParams(location.search).get("example") === "1",
    ),
    camera = useRef(null),
    restoredKey = useRef(""),
    skipVisitedWrite = useRef(false),
    exampleStart = useRef(Date.now());
  const examples = useMemo(
    () => makeExamples(period, exampleStart.current),
    [period],
  );
  const demoEdition = rules.editionWindow(period, now),
    edition = data.edition || demoEdition,
    key = `${demo ? "example" : "public"}/${demo ? demoEdition.id : edition.id}`;
  const editionPosts = useMemo(
    () =>
      demo
        ? [
            ...exampleCreations.filter(
              (p) =>
                p.editionId === demoEdition.id ||
                (period === "archive" && p.lifetime === "permanent"),
            ),
            ...examples,
          ]
        : data.items,
    [demo, exampleCreations, demoEdition.id, period, examples, data.items],
  );
  const source = useMemo(
    () =>
      editionPosts.filter((p) => !p.expiresAt || Date.parse(p.expiresAt) > now),
    [editionPosts, now],
  );
  const positioned = useMemo(() => layoutPosts(editionPosts), [editionPosts]);
  const filtered = useMemo(
    () => filterPosts(positioned, filters, now),
    [positioned, filters, now],
  );
  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const explored = source.filter((p) => visitedSet.has(p.id)).length,
    total = source.length,
    finished = total > 0 && explored === total;
  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
    saveLocal("parchar_spatial_theme_v1", theme);
  }, [theme]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const refresh = () => setUser(session());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/edition?period=${period}`, { signal: controller.signal })
      .then((next) => {
        setData(next);
        if (!next.items.length && !sourceChosen.current) {
          setDemo(true);
          setToast(
            "Esta edición todavía no tiene publicaciones. Estás viendo un ejemplo.",
          );
        }
        sourceChosen.current = true;
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          if (!sourceChosen.current) setDemo(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, revision]);
  useEffect(() => {
    if (restoredKey.current !== key) {
      restoredKey.current = key;
      skipVisitedWrite.current = true;
      dispatchVisited({
        type: "restore",
        ids: readLocal(`parchar_spatial_seen/${key}`, []),
      });
      setClosedEdition("");
    }
  }, [key]);
  useEffect(() => {
    if (skipVisitedWrite.current) {
      skipVisitedWrite.current = false;
      return;
    }
    if (restoredKey.current === key)
      saveLocal(`parchar_spatial_seen/${key}`, visited);
  }, [key, visited]);
  useEffect(
    () =>
      saveLocal("parchar_spatial_examples_v1", exampleCreations.slice(0, 48)),
    [exampleCreations],
  );
  useEffect(
    () => saveLocal("parchar_spatial_demo_signals_v1", demoSignals),
    [demoSignals],
  );
  useEffect(
    () => saveLocal("parchar_spatial_demo_notes_v1", demoNotes.slice(-300)),
    [demoNotes],
  );
  const loadPersonal = async () => {
    if (!session().token) {
      setPersonal({ signals: [], capsules: [], thanks: {} });
      setMine([]);
      return;
    }
    try {
      const result = await api("/personal");
      setPersonal(result);
    } catch (err) {
      if (err.status !== 401) setToast(err.message);
    }
  };
  useEffect(() => {
    loadPersonal();
  }, [user.token]);
  useEffect(() => {
    if (view !== "mine" || demo || !user.token) return;
    let current = true;
    api("/mine")
      .then((next) => {
        if (current)
          setMine(
            next.items.map((p) => ({
              ...p,
              title: p.title || p.text?.slice(0, 70) || "Mi creación",
              topic: p.topic || "reflexiones",
              depth: p.depth ?? 25,
            })),
          );
      })
      .catch((err) => setToast(err.message));
    return () => {
      current = false;
    };
  }, [view, demo, user.token, revision]);
  useEffect(() => {
    if (!selected) return;
    setDetailNotice("");
    if (demo) {
      setNotes([
        ...exampleNotes(selected),
        ...demoNotes.filter((n) => n.parentId === selected.id),
      ]);
      return;
    }
    const controller = new AbortController();
    setNotes([]);
    api(`/${selected.id}/notes`, { signal: controller.signal })
      .then((next) => setNotes(next.items))
      .catch((err) => {
        if (err.name !== "AbortError") setDetailNotice(err.message);
      });
    return () => controller.abort();
  }, [selected?.id, demo, demoNotes]);
  function open(post) {
    setSelected(post);
    if (view === "map") dispatchVisited({ type: "visit", id: post.id });
  }
  function changeSource() {
    sourceChosen.current = true;
    setDemo(!demo);
    setView("map");
    setSelected(null);
    camera.current = null;
    setFocusRequest((n) => n + 1);
  }
  function chooseTopic(id) {
    camera.current = null;
    setTopic(id);
    setListMode(false);
    setView("map");
    setFocusRequest((n) => n + 1);
  }
  const requireLogin = () => {
    if (!session().token)
      throw new Error(
        "Inicia sesión desde el icono de cuenta para participar.",
      );
  };
  async function echo(post, kind, active) {
    if (demo) {
      setDemoSignals((prev) =>
        active
          ? [
              ...prev.filter((s) => !(s.postId === post.id && s.kind === kind)),
              { postId: post.id, kind },
            ]
          : prev.filter((s) => !(s.postId === post.id && s.kind === kind)),
      );
      return;
    }
    requireLogin();
    await api(`/${post.id}/echo`, {
      method: "POST",
      body: JSON.stringify({ kind, active }),
    });
    await loadPersonal();
  }
  function payload(form) {
    return {
      format: "spatial-v1",
      kind: "node",
      alias: form.alias.trim(),
      title: form.title.trim(),
      text: form.text.trim(),
      topic: form.topic,
      city: form.city,
      depth: Number(form.depth),
      lifetime: form.lifetime,
      avatar: "violeta",
      background: "#18112c",
      strokes: [],
      moderationConsent: true,
    };
  }
  async function createNode(form) {
    const body = payload(form);
    if (demo) {
      if (
        exampleCreations.length >= 36 ||
        editionPosts.filter((p) => p.topic === body.topic).length >= 12
      )
        throw new Error(
          "Esta isla ya completó sus 12 nodos. Elige otra isla o retira una creación de ejemplo desde Mis publicaciones.",
        );
      const id = `local-${crypto.randomUUID()}`,
        expiresAt =
          rules.LIFETIMES[body.lifetime] === null
            ? null
            : new Date(
                Date.now() + rules.LIFETIMES[body.lifetime],
              ).toISOString();
      setExampleCreations((prev) => [
        {
          ...body,
          id,
          createdAt: new Date().toISOString(),
          expiresAt,
          editionId: demoEdition.id,
          contributions: 0,
          status: "activo",
        },
        ...prev,
      ]);
      chooseTopic(body.topic);
      setToast("Nodo creado en la edición de ejemplo.");
    } else {
      requireLogin();
      const result = await api("", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToast(result.message);
      setView("mine");
      setRevision((n) => n + 1);
    }
  }
  async function addNote(post, text, anchor) {
    if (!anchor || !text.trim()) throw new Error("Escribe tu nota.");
    const alias = (session().client?.fullName || "Parcero").slice(0, 24),
      body = {
        ...payload({
          alias,
          title: `Nota en ${post.title}`.slice(0, 100),
          text,
          topic: post.topic,
          city: post.city || "",
          depth: post.depth,
          lifetime: "7d",
        }),
        kind: "note",
        parentId: post.id,
        anchor,
      };
    if (demo) {
      setDemoNotes((prev) => [
        ...prev,
        {
          ...body,
          id: `local-note-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }
    requireLogin();
    const result = await api("", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setNotes((prev) => [
      ...prev,
      { ...body, id: result.id, status: "pendiente" },
    ]);
  }
  async function report(post, reason) {
    if (demo) {
      setToast("Reporte de ejemplo registrado solo en este dispositivo.");
      return;
    }
    requireLogin();
    await api(`/${post.id}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }
  async function remove(post) {
    if (demo) {
      setExampleCreations((prev) => prev.filter((p) => p.id !== post.id));
      setDemoNotes((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      requireLogin();
      await api(`/${post.id}/delete`, { method: "POST", body: "{}" });
      setMine((prev) => prev.filter((p) => p.id !== post.id));
      setRevision((n) => n + 1);
    }
    setToast("Publicación retirada.");
  }
  const signals = demo ? demoSignals : personal.signals;
  const savedPosts = demo
    ? source.filter((p) =>
        demoSignals.some((s) => s.postId === p.id && s.kind === "capsule"),
      )
    : personal.capsules;
  const listItems =
    view === "mine"
      ? demo
        ? exampleCreations
        : mine
      : view === "capsule"
        ? savedPosts
        : filtered;
  return (
    <div className="sw-app">
      <header className="sw-header">
        <a
          className="sw-icon"
          href="/"
          aria-label="Volver a Parchar"
          title="Volver a Parchar"
        >
          <ArrowLeft size={21} />
        </a>
        <div className="sw-brand">
          <img src="/assets/parchar-logo-home.png" alt="Parchar" />
          <div>
            <h1>Muro</h1>
            <span>Una edición para descubrir</span>
          </div>
        </div>
        <div className="sw-header-actions">
          <button
            className="sw-icon"
            title={demo ? "Ver comunidad real" : "Ver edición de ejemplo"}
            aria-label={demo ? "Ver comunidad real" : "Ver edición de ejemplo"}
            onClick={changeSource}
          >
            <FlaskConical size={20} />
          </button>
          <button
            className="sw-icon"
            title={theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
            aria-label={
              theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"
            }
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <a
            className="sw-icon"
            href="/clients.html?next=creative"
            title="Mi cuenta"
            aria-label="Mi cuenta"
          >
            <UserRound size={20} />
          </a>
        </div>
      </header>
      <div className="sw-edition-bar">
        <AlgorithmTuner
          filters={filters}
          onChange={setFilters}
          open={tuner}
          setOpen={setTuner}
          period={period}
          setPeriod={(p) => {
            setPeriod(p);
            setView("map");
          }}
        />
        <button
          className="sw-icon"
          aria-label="Actualizar edición"
          title="Actualizar edición"
          onClick={() => setRevision((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "sw-loading" : ""} />
        </button>
        {demo && <span className="sw-demo-badge">Ejemplo</span>}
      </div>
      <nav className="sw-topic-nav" aria-label="Islas temáticas">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            style={{ "--island-color": t.color }}
            aria-pressed={view === "map" && topic === t.id}
            onClick={() => chooseTopic(t.id)}
          >
            <span />
            {t.name}
          </button>
        ))}
      </nav>
      <div className="sw-view-bar">
        <div className="flex items-center gap-1">
          <button
            className={`sw-small-button ${view === "map" ? "is-active" : ""}`}
            onClick={() => setView("map")}
          >
            <Map size={16} />
            Edición
          </button>
          <button
            className={`sw-small-button ${view === "capsule" ? "is-active" : ""}`}
            onClick={() => setView("capsule")}
          >
            <Bookmark size={16} />
            <span>Cápsula</span>
          </button>
          <button
            className={`sw-small-button ${view === "mine" ? "is-active" : ""}`}
            onClick={() => setView("mine")}
          >
            <UserRound size={16} />
            <span>Mis publicaciones</span>
          </button>
        </div>
        {view === "map" && (
          <button
            className="sw-icon"
            title={listMode ? "Ver lienzo" : "Ver lista"}
            aria-label={listMode ? "Ver lienzo" : "Ver lista"}
            onClick={() => setListMode(!listMode)}
          >
            {listMode ? <Map size={18} /> : <LayoutList size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p className="sw-error" role="alert">
          {error}{" "}
          <button
            className="sw-text-button"
            onClick={() => setRevision((n) => n + 1)}
          >
            Reintentar
          </button>
        </p>
      )}
      {view === "map" && !listMode ? (
        <div className="sw-stage">
          <SpatialCanvas
            nodes={filtered}
            topic={topic}
            focusRequest={focusRequest}
            onOpen={open}
            visited={visitedSet}
            onCreate={() => setCreate(true)}
            cameraRef={camera}
            now={now}
          />
          {!filtered.length && !loading && (
            <div className="sw-empty">
              <h2>No hay nodos con estos ajustes</h2>
              <button
                className="sw-button"
                onClick={() => setFilters({ city: "", reach: 100, depth: 0 })}
              >
                Ver toda la edición
              </button>
              <button
                className="sw-text-button"
                onClick={() => setCreate(true)}
              >
                Crear un nodo
              </button>
            </div>
          )}
        </div>
      ) : (
        <section
          className="sw-list"
          aria-label={
            view === "mine"
              ? "Mis publicaciones"
              : view === "capsule"
                ? "Mi cápsula"
                : "Lista de la edición"
          }
        >
          {!demo && !user.token && view !== "map" ? (
            <div className="sw-empty-list">
              <LogIn size={28} />
              <h2>Tu espacio personal</h2>
              <a className="sw-primary" href="/clients.html?next=creative">
                Iniciar sesión
              </a>
            </div>
          ) : (
            <>
              {view === "mine" && !demo && (
                <p className="sw-personal-thanks">
                  Agradecimientos privados recibidos:{" "}
                  {personal.thanks.think || 0} «Me hizo pensar» ·{" "}
                  {personal.thanks.useful || 0} «Me sirvió»
                </p>
              )}
              {listItems.map((post) => (
                <PostNode
                  key={post.id}
                  post={post}
                  visited={visitedSet.has(post.id)}
                  onOpen={open}
                  list
                  now={now}
                />
              ))}
              {!listItems.length && (
                <div className="sw-empty-list">
                  <h2>
                    {view === "capsule"
                      ? "Tu cápsula está vacía"
                      : view === "mine"
                        ? "Todavía no has publicado"
                        : "No hay nodos con estos ajustes"}
                  </h2>
                  <button className="sw-button" onClick={() => setCreate(true)}>
                    Crear un nodo
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <footer className="sw-progress">
        <span>
          {demo ? "Ejemplo · " : ""}Exploraste{" "}
          <strong>
            {explored} de {total}
          </strong>{" "}
          nodos de esta edición
        </span>
        <progress
          value={explored}
          max={Math.max(1, total)}
          aria-label="Progreso de exploración"
        />
      </footer>
      {finished && closedEdition !== key && (
        <div className="sw-complete" role="status">
          <Check size={22} />
          <div>
            <strong>Estás al día en esta edición</strong>
            <p>Puedes volver cuando quieras.</p>
          </div>
          <button
            className="sw-icon"
            aria-label="Cerrar aviso de edición completada"
            title="Cerrar aviso"
            onClick={() => setClosedEdition(key)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {toast && (
        <div className="sw-toast" role="status" key={toast}>
          {toast}
        </div>
      )}
      {create && (
        <CreateNodeModal
          onClose={() => setCreate(false)}
          onSubmit={createNode}
          demo={demo}
          user={user}
          initialTopic={topic}
        />
      )}
      {selected && (
        <NodeDetailModal
          post={selected}
          onClose={() => setSelected(null)}
          onEcho={echo}
          signals={signals}
          onNote={addNote}
          notes={notes}
          notice={detailNotice}
          onReport={report}
          onDelete={view === "mine" ? remove : null}
          demo={demo}
          now={now}
        />
      )}
    </div>
  );
}
