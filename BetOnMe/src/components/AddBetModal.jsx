import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import MapPicker from "./MapPicker";
import "./AddBetModal.css";

// Default center: University of Kansas rec center. Users pick on the map.
const DEFAULT_LAT = 38.9543;
const DEFAULT_LNG = -95.2535;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_RECURRING_WEEKS = 4;
const MAX_RECURRING_SESSIONS = 28;

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTimeValue(hour, minute) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hour)}:${pad(minute)}`;
}

function parseTimeValue(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// Expand the recurring spec into a concrete list of Date instants in the
// user's local timezone. The browser is the only place that knows the
// user's tz, so we do this here and ship ISO strings to the server.
//
// Rules:
// - Week 1 starts "now". For each chosen day-of-week, the first occurrence
//   is the next time that weekday (today included) falls at the chosen
//   time. If today's chosen time has already passed, week 1 starts on the
//   following week's instance for that day.
// - Subsequent weeks are +7 days from the previous occurrence per day.
function expandSchedule({ daysOfWeek, timeMode, same, perDay, weeks }) {
  const out = [];
  const now = new Date();
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

  for (const dow of sortedDays) {
    const time =
      timeMode === "perDay" && perDay && perDay[dow]
        ? perDay[dow]
        : same;
    if (!time) continue;

    // Find the first occurrence of this day at this time on or after `now`.
    const first = new Date(now);
    first.setHours(time.hour, time.minute, 0, 0);
    const dayDelta = (dow - first.getDay() + 7) % 7;
    first.setDate(first.getDate() + dayDelta);
    if (first.getTime() < now.getTime()) {
      // Today is the chosen weekday but we're already past the chosen time.
      first.setDate(first.getDate() + 7);
    }

    for (let w = 0; w < weeks; w++) {
      const occ = new Date(first);
      occ.setDate(occ.getDate() + 7 * w);
      out.push(occ);
    }
  }

  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

function describeOccurrence(date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AddBetModal({ open, onClose, onCreated }) {
  const [charities, setCharities] = useState([]);
  const [betType, setBetType] = useState("single");
  const [form, setForm] = useState(() => {
    const start = new Date();
    return {
      title: "",
      stake: "2",
      targetAt: toDatetimeLocalValue(start),
      windowMinutes: 120,
      locationName: "",
      lat: DEFAULT_LAT,
      lng: DEFAULT_LNG,
      radiusMeters: 75,
      charityId: "redcross",
    };
  });

  // Recurring-only state. Lives separately so toggling between Single and
  // Recurring doesn't blow away the user's other selections.
  const [recurring, setRecurring] = useState(() => ({
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri to start
    timeMode: "same",
    sameTime: { hour: 7, minute: 0 },
    perDayTime: {}, // dow -> { hour, minute }
    weeks: 1,
  }));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    api
      .charities()
      .then((res) => setCharities(res.charities || []))
      .catch(() => setCharities([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const previewOccurrences = useMemo(() => {
    if (betType !== "recurring") return [];
    if (!recurring.daysOfWeek.length) return [];
    try {
      return expandSchedule({
        daysOfWeek: recurring.daysOfWeek,
        timeMode: recurring.timeMode,
        same: recurring.sameTime,
        perDay: recurring.perDayTime,
        weeks: recurring.weeks,
      });
    } catch {
      return [];
    }
  }, [betType, recurring]);

  if (!open) return null;

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function updateRecurring(patch) {
    setRecurring((r) => ({ ...r, ...patch }));
  }

  function toggleDay(dow) {
    setRecurring((r) => {
      const has = r.daysOfWeek.includes(dow);
      const nextDays = has
        ? r.daysOfWeek.filter((d) => d !== dow)
        : [...r.daysOfWeek, dow].sort((a, b) => a - b);
      return { ...r, daysOfWeek: nextDays };
    });
  }

  function setSameTimeFromInput(value) {
    const parsed = parseTimeValue(value);
    if (!parsed) return;
    updateRecurring({ sameTime: parsed });
  }

  function setPerDayTimeFromInput(dow, value) {
    const parsed = parseTimeValue(value);
    if (!parsed) return;
    setRecurring((r) => ({
      ...r,
      perDayTime: { ...r.perDayTime, [dow]: parsed },
    }));
  }

  function describeCreateError(err) {
    if (!err) return "Failed to create goal.";
    if (err.kind === "network") {
      return "Couldn't reach the server. Check your internet connection and try again.";
    }
    if (err.status === 401) {
      return "Your session expired. Please sign in again, then retry.";
    }
    if (err.status === 402 || /insufficient/i.test(err.message || "")) {
      return "The shared XRPL pot doesn't have enough XRP to cover this stake. Lower the amount or top up the pot.";
    }
    if (err.status >= 500) {
      return `Server error: ${err.message}. Try again in a few seconds.`;
    }
    return err.message || "Failed to create goal.";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      return setError("Goal title is required (e.g. \"Go to the gym\").");
    }
    if (form.title.trim().length > 200) {
      return setError("Goal title is too long (200 characters max).");
    }

    const stakeNum = Number(form.stake);
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      return setError(
        "Stake must be a positive number of XRP (e.g. 2 or 0.5)."
      );
    }
    if (stakeNum > 1000) {
      return setError(
        "Stake is too large. Pick something under 1000 XRP for the demo."
      );
    }

    const windowMins = Number(form.windowMinutes);
    if (!Number.isFinite(windowMins) || windowMins < 5) {
      return setError("Window must be at least 5 minutes.");
    }

    if (!Number.isFinite(Number(form.lat)) || !Number.isFinite(Number(form.lng))) {
      return setError("Pick a location on the map first.");
    }

    let payload;
    if (betType === "single") {
      if (!form.targetAt) {
        return setError("Target time is required.");
      }
      const targetDate = new Date(form.targetAt);
      if (Number.isNaN(targetDate.getTime())) {
        return setError("Target time is invalid — pick a date and time.");
      }

      payload = {
        title: form.title.trim(),
        stakeAmount: stakeNum,
        type: "single",
        charityId: form.charityId,
        location: {
          name: form.locationName.trim() || null,
          lat: Number(form.lat),
          lng: Number(form.lng),
          radiusMeters: Number(form.radiusMeters) || 75,
        },
        target: {
          targetAt: targetDate.toISOString(),
          windowMinutes: windowMins || 120,
        },
      };
    } else {
      // recurring
      if (!recurring.daysOfWeek.length) {
        return setError("Pick at least one day of the week.");
      }
      if (
        !Number.isInteger(recurring.weeks) ||
        recurring.weeks < 1 ||
        recurring.weeks > MAX_RECURRING_WEEKS
      ) {
        return setError(`Weeks must be between 1 and ${MAX_RECURRING_WEEKS}.`);
      }

      // Make sure every chosen day has a time when in per-day mode.
      if (recurring.timeMode === "perDay") {
        for (const dow of recurring.daysOfWeek) {
          const t = recurring.perDayTime[dow] || recurring.sameTime;
          if (!t) {
            return setError(
              `Pick a time for ${DAY_LABELS[dow]} or switch to "same time every day".`
            );
          }
        }
      }

      const occurrences = expandSchedule({
        daysOfWeek: recurring.daysOfWeek,
        timeMode: recurring.timeMode,
        same: recurring.sameTime,
        perDay: recurring.perDayTime,
        weeks: recurring.weeks,
      });

      if (occurrences.length === 0) {
        return setError("Couldn't compute any sessions from that schedule.");
      }
      if (occurrences.length > MAX_RECURRING_SESSIONS) {
        return setError(
          `Too many sessions (${occurrences.length}). Reduce days or weeks (max ${MAX_RECURRING_SESSIONS}).`
        );
      }

      payload = {
        title: form.title.trim(),
        stakeAmount: stakeNum,
        type: "recurring",
        charityId: form.charityId,
        location: {
          name: form.locationName.trim() || null,
          lat: Number(form.lat),
          lng: Number(form.lng),
          radiusMeters: Number(form.radiusMeters) || 75,
        },
        schedule: {
          daysOfWeek: recurring.daysOfWeek,
          weeks: recurring.weeks,
          timeMode: recurring.timeMode,
          same:
            recurring.timeMode === "same"
              ? { hour: recurring.sameTime.hour, minute: recurring.sameTime.minute }
              : null,
          perDay:
            recurring.timeMode === "perDay"
              ? Object.fromEntries(
                  recurring.daysOfWeek.map((dow) => {
                    const t = recurring.perDayTime[dow] || recurring.sameTime;
                    return [dow, { hour: t.hour, minute: t.minute }];
                  })
                )
              : null,
        },
        target: {
          scheduledTimes: occurrences.map((d) => d.toISOString()),
          windowMinutes: windowMins || 120,
        },
      };
    }

    setSubmitting(true);
    try {
      const res = await api.createGoal(payload);
      onCreated?.(res);
      onClose?.();
    } catch (err) {
      setError(describeCreateError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const previewCount = previewOccurrences.length;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Bet</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="type-toggle" role="tablist" aria-label="Bet type">
              <button
                type="button"
                role="tab"
                aria-selected={betType === "single"}
                className={`type-toggle-btn ${betType === "single" ? "active" : ""}`}
                onClick={() => setBetType("single")}
              >
                One-time
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={betType === "recurring"}
                className={`type-toggle-btn ${betType === "recurring" ? "active" : ""}`}
                onClick={() => setBetType("recurring")}
              >
                Recurring
              </button>
            </div>
          </div>

          <div className="form-row">
            <label className="label" htmlFor="title">
              Goal
            </label>
            <input
              id="title"
              className="input"
              placeholder="e.g. Go to the gym"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>

          {betType === "single" ? (
            <div className="form-grid">
              <div className="form-row">
                <label className="label">Target time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.targetAt}
                  onChange={(e) => update({ targetAt: e.target.value })}
                />
              </div>

              <div className="form-row">
                <label className="label">Window (± minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  className="input"
                  value={form.windowMinutes}
                  onChange={(e) => update({ windowMinutes: e.target.value })}
                />
                <div className="muted small" style={{ marginTop: 4 }}>
                  Check-in must happen within ± this many minutes of the
                  target time. 120 = ±2 hours, 720 = anytime that day.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="form-row">
                <label className="label">Days of the week</label>
                <div className="day-chips" role="group" aria-label="Days of the week">
                  {DAY_LABELS.map((label, dow) => {
                    const active = recurring.daysOfWeek.includes(dow);
                    return (
                      <button
                        key={dow}
                        type="button"
                        className={`day-chip ${active ? "active" : ""}`}
                        aria-pressed={active}
                        onClick={() => toggleDay(dow)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-grid">
                <div className="form-row">
                  <label className="label">Time</label>
                  <div className="type-toggle" role="tablist" aria-label="Time mode">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={recurring.timeMode === "same"}
                      className={`type-toggle-btn ${recurring.timeMode === "same" ? "active" : ""}`}
                      onClick={() => updateRecurring({ timeMode: "same" })}
                    >
                      Same every day
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={recurring.timeMode === "perDay"}
                      className={`type-toggle-btn ${recurring.timeMode === "perDay" ? "active" : ""}`}
                      onClick={() => updateRecurring({ timeMode: "perDay" })}
                    >
                      Per day
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <label className="label">Repeat for (weeks)</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_RECURRING_WEEKS}
                    className="input"
                    value={recurring.weeks}
                    onChange={(e) =>
                      updateRecurring({
                        weeks: Math.max(
                          1,
                          Math.min(
                            MAX_RECURRING_WEEKS,
                            Number(e.target.value) || 1
                          )
                        ),
                      })
                    }
                  />
                </div>
              </div>

              {recurring.timeMode === "same" ? (
                <div className="form-grid">
                  <div className="form-row">
                    <label className="label">Same time every chosen day</label>
                    <input
                      type="time"
                      className="input"
                      value={toTimeValue(
                        recurring.sameTime.hour,
                        recurring.sameTime.minute
                      )}
                      onChange={(e) => setSameTimeFromInput(e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <label className="label">Window (± minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      className="input"
                      value={form.windowMinutes}
                      onChange={(e) => update({ windowMinutes: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <label className="label">Time per day</label>
                    <div className="per-day-times">
                      {recurring.daysOfWeek.length === 0 ? (
                        <div className="muted small">
                          Pick at least one day above to set times.
                        </div>
                      ) : (
                        recurring.daysOfWeek.map((dow) => {
                          const t =
                            recurring.perDayTime[dow] || recurring.sameTime;
                          return (
                            <div key={dow} className="per-day-row">
                              <span className="per-day-label">
                                {DAY_LABELS[dow]}
                              </span>
                              <input
                                type="time"
                                className="input"
                                value={toTimeValue(t.hour, t.minute)}
                                onChange={(e) =>
                                  setPerDayTimeFromInput(dow, e.target.value)
                                }
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <label className="label">Window (± minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      className="input"
                      value={form.windowMinutes}
                      onChange={(e) => update({ windowMinutes: e.target.value })}
                    />
                  </div>
                </>
              )}

              {previewCount > 0 && (
                <div className="schedule-preview">
                  <div className="muted small" style={{ marginBottom: 6 }}>
                    {previewCount} session{previewCount === 1 ? "" : "s"} —
                    you must check in to <strong>all of them</strong> to win the
                    stake back.
                  </div>
                  <ul className="schedule-list">
                    {previewOccurrences.slice(0, 6).map((d) => (
                      <li key={d.toISOString()}>{describeOccurrence(d)}</li>
                    ))}
                    {previewOccurrences.length > 6 && (
                      <li className="muted">
                        + {previewOccurrences.length - 6} more…
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="form-grid">
            <div className="form-row">
              <label className="label">
                {betType === "recurring"
                  ? "Total stake (XRP)"
                  : "Amount (XRP)"}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className="input"
                value={form.stake}
                onChange={(e) => update({ stake: e.target.value })}
              />
              {betType === "recurring" && previewCount > 0 && (
                <div className="muted small" style={{ marginTop: 4 }}>
                  ≈ {(Number(form.stake) / previewCount || 0).toFixed(2)} XRP per
                  session if you complete the schedule.
                </div>
              )}
            </div>

            <div className="form-row">
              <label className="label">Charity (on fail)</label>
              <select
                className="select"
                value={form.charityId}
                onChange={(e) => update({ charityId: e.target.value })}
              >
                {charities.length === 0 ? (
                  <option value="redcross">American Red Cross</option>
                ) : (
                  charities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <hr />

          <div className="form-row">
            <label className="label">Location name (optional)</label>
            <input
              className="input"
              placeholder="e.g. Gym"
              value={form.locationName}
              onChange={(e) => update({ locationName: e.target.value })}
            />
          </div>

          <div className="form-row">
            <label className="label">Pick location on map</label>
            <MapPicker
              value={{ lat: Number(form.lat), lng: Number(form.lng) }}
              radiusMeters={Number(form.radiusMeters) || 75}
              onChange={({ lat, lng }) => update({ lat, lng })}
            />
          </div>

          <div className="form-row">
            <label className="label">
              Check-in radius: {form.radiusMeters} m
            </label>
            <input
              type="range"
              min="20"
              max="500"
              step="5"
              className="range"
              value={form.radiusMeters}
              onChange={(e) => update({ radiusMeters: Number(e.target.value) })}
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Add bet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddBetModal;
