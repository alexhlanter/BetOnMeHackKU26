import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import "./ProofUploadModal.css";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function ProofUploadModal({ open, goal, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset all modal state when it's closed so a reopen starts clean.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
      setResult(null);
      setSubmitting(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  function pickFile(f) {
    setError(null);
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type && !ALLOWED.includes(f.type)) {
      setError(`Unsupported file type: ${f.type}`);
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB).");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Pick a photo first.");
    if (!goal?.id) return setError("Missing goal id.");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("goalId", goal.id);

    setSubmitting(true);
    try {
      const res = await api.uploadProof(fd);
      setResult(res);
      onUploaded?.(res);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  const verdict = result?.verification?.status;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal proof-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload proof</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="muted" style={{ marginBottom: 12 }}>
          For <strong>{goal?.title || "this goal"}</strong>. We read EXIF GPS +
          timestamp from your photo, compare it to the goal's location &amp;
          window, and auto-resolve on success.
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label className="label">Photo</label>
            <label className="file-drop">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="file-preview" />
              ) : (
                <div className="file-drop-empty">
                  <div className="file-drop-plus">📷</div>
                  <div>Click to choose a photo</div>
                  <div className="muted small">
                    JPG, PNG, WebP, or HEIC — up to 10 MB
                  </div>
                </div>
              )}
            </label>
            {file && (
              <div className="muted small" style={{ marginTop: 6 }}>
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>

          {error && <div className="error-banner">{error}</div>}

          {result && (
            <div
              className={`result-banner ${
                verdict === "verified" ? "ok" : "bad"
              }`}
            >
              <div className="result-title">
                {verdict === "verified" ? "✓ Verified" : "✗ Rejected"}
              </div>
              <div className="muted small">
                {result.verification?.reason || "(no reason)"}
              </div>
              {typeof result.verification?.distanceMeters === "number" && (
                <div className="muted small">
                  distance: {Math.round(result.verification.distanceMeters)} m
                </div>
              )}
              {result.resolution?.status && (
                <div className="small" style={{ marginTop: 6 }}>
                  Goal auto-resolved to{" "}
                  <strong>{result.resolution.status}</strong>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !file}
              >
                {submitting ? "Uploading…" : "Submit proof"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProofUploadModal;
