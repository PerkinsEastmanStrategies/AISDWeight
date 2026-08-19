import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DataProvider, useAppData } from "./lib/DataContext";
import { WeightingPage } from "./pages/WeightingPage";
import { WalkthroughModal } from "./components/WalkthroughModal";
import { hasSeenWalkthrough, markWalkthroughSeen } from "./lib/storage";

function AdminShell() {
  const { loading, error, catalog } = useAppData();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);

  useEffect(() => {
    if (!catalog) return;
    if (!hasSeenWalkthrough()) setWalkthroughOpen(true);
  }, [catalog]);

  function closeWalkthrough() {
    markWalkthroughSeen();
    setWalkthroughOpen(false);
  }

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
    <WalkthroughModal open={walkthroughOpen} onClose={closeWalkthrough}>
      <div className="app-shell wide">
        <header className="app-header">
          <div>
            <h1 className="brand">ESA Scoring Review</h1>
            <p className="brand-sub">
              {catalog.meta.school} · focus area / space type / category weighting
            </p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="btn how-to-btn"
              onClick={() => setWalkthroughOpen(true)}
            >
              <span className="how-to-icon" aria-hidden="true">
                ?
              </span>
              How to use
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<WeightingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </WalkthroughModal>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AdminShell />
    </DataProvider>
  );
}
