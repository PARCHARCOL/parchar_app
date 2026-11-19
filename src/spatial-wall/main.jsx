import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
class WallBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="sw-recovery">
        <h1>No se pudo abrir esta edición</h1>
        <button className="sw-primary" onClick={() => location.reload()}>
          Reintentar
        </button>
        <a href="/">Volver a Parchar</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("spatial-root")).render(
  <WallBoundary>
    <App />
  </WallBoundary>,
);
