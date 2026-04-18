import { useEffect } from "react";
import { useAuth } from "../lib/authContextCore";
import { useDevMode } from "../lib/devModeCore";
import "./Sidebar.css";

function truncateAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function Sidebar({ open, onClose, goals = [] }) {
  const { user } = useAuth();
  const { enabled, setEnabled, adminSecret, setAdminSecret } = useDevMode();

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const resolved = goals.filter((g) => g.status === "succeeded" || g.status === "failed");

  return (
    <>
      <div className={`sidebar-scrim ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="sidebar-header">
          <div className="sidebar-avatar">
            {user?.displayName?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <div className="sidebar-name">{user?.displayName || "Not signed in"}</div>
            <div className="sidebar-username muted">
              {user ? `@${user.username}` : ""}
            </div>
          </div>
          <button className="btn btn-ghost sidebar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sidebar-section">
          <div className="section-title">Wallet</div>
          <div className="wallet-card">
            <div className="wallet-label muted">XRPL address (shared demo wallet)</div>
            <div className="wallet-addr" title={user?.walletAddress || ""}>
              {truncateAddr(user?.walletAddress)}
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-title">Dev mode</div>
          <label className="dev-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable dev actions (force succeed / fail)</span>
          </label>
          {enabled && (
            <div style={{ marginTop: 10 }}>
              <label className="label">Admin secret</label>
              <input
                type="password"
                className="input"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="ADMIN_SECRET from .env.local"
              />
              <div className="muted small" style={{ marginTop: 4 }}>
                Needed to call <code>/api/goals/resolve</code>. Stored in your
                browser only.
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="section-title">Bet history</div>
          {resolved.length === 0 ? (
            <div className="muted">No resolved bets yet.</div>
          ) : (
            <ul className="history">
              {resolved.slice(0, 8).map((g) => (
                <li key={g.id} className="history-row">
                  <span className="history-title">{g.title}</span>
                  <span className={`badge ${g.status === "succeeded" ? "badge-success" : "badge-failed"}`}>
                    {g.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
