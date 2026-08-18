import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { DataProvider, useAppData } from "./lib/DataContext";
import { WeightingPage } from "./pages/WeightingPage";

function AdminShell() {
  const { loading, error, catalog } = useAppData();

  if (loading) {
    return <div className="loading">Loading catalog…</div>;
  }
  if (error || !catalog) {
    return (
      <div className="app-shell">
        <div className="callout warn">
          {error || "Catalog missing."} Run{" "}
          <span className="mono">npm run import-xlsx</span> then restart the dev server.
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell wide">
      <header className="app-header">
        <div>
          <h1 className="brand">ESA Scoring Review</h1>
          <p className="brand-sub">
            {catalog.meta.school} · focus area / space type / category weighting
          </p>
        </div>
        <nav className="nav-tabs">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Weighting
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<WeightingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AdminShell />
    </DataProvider>
  );
}
