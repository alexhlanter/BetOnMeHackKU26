import "./Docs.css";

function Docs() {
  return (
    <div className="page">
      <header className="docs-hero">
        <h1>How BetOnMe works</h1>
        <p>
          A short, high-level tour of the system: what happens when you commit
          to a goal, how we verify you showed up, and why your stake can only
          ever go to one of two places.
        </p>
      </header>

      <section className="docs-section">
        <div className="section-title">The bet flow</div>
        <div className="docs-grid-3">
          <div className="box docs-step">
            <span className="step-num">1</span>
            <h3>Commit</h3>
            <p>
              Pick a goal, a place, a time window, and a charity. Stake an
              amount in XRP. Your stake is locked in an on-chain escrow whose
              destination is the charity you chose &mdash; nothing else.
            </p>
          </div>
          <div className="box docs-step">
            <span className="step-num">2</span>
            <h3>Prove</h3>
            <p>
              Take a photo at the spot during the window. We check EXIF time,
              GPS coordinates, and (optionally) the scene itself with a
              vision-language model.
            </p>
          </div>
          <div className="box docs-step">
            <span className="step-num">3</span>
            <h3>Resolve</h3>
            <p>
              Verified: you reclaim your stake after the deadline. No-show: our
              server signs the escrow release and the funds move to your chosen
              charity, on-chain.
            </p>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <div className="section-title">Architecture at a glance</div>
        <div className="docs-grid-4">
          <div className="box docs-card">
            <span className="badge badge-active">Frontend</span>
            <h3 style={{ marginTop: 8 }}>React + Vite</h3>
            <p>
              Single-page app served from <code>/app</code>. Talks to the
              backend over a small typed client.
            </p>
          </div>
          <div className="box docs-card">
            <span className="badge badge-active">Backend</span>
            <h3 style={{ marginTop: 8 }}>Next.js API routes</h3>
            <p>
              Stateless route handlers under <code>app/api/*</code>. Auth is a
              custom HMAC-signed session cookie.
            </p>
          </div>
          <div className="box docs-card">
            <span className="badge badge-active">Database</span>
            <h3 style={{ marginTop: 8 }}>MongoDB Atlas</h3>
            <p>
              Stores users, goals, and proof records. Each goal carries both a
              business state and a chain state.
            </p>
          </div>
          <div className="box docs-card">
            <span className="badge badge-active">Chain + AI</span>
            <h3 style={{ marginTop: 8 }}>XRPL + Gemma</h3>
            <p>
              Time-bounded escrow on the XRP Ledger testnet. Optional Gemma
              vision check to sanity-test the photo.
            </p>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <div className="section-title">The escrow model</div>
        <div className="box">
          <ul className="docs-bullets">
            <li>
              <span>
                <strong>Destination is frozen at create time.</strong> When the
                escrow is created on the XRP Ledger, the charity address is
                baked in. It cannot be changed afterward &mdash; not by the
                user, not by us.
              </span>
            </li>
            <li>
              <span>
                <strong>Two state fields, one resolver.</strong> Every goal
                tracks <code>status</code> (active &rarr; succeeded / failed)
                separately from <code>escrowState</code> (locked &rarr; finished
                / cancelled). All transitions go through one server-side
                resolver, so there's exactly one place that decides what to
                submit on-chain.
              </span>
            </li>
            <li>
              <span>
                <strong>Pot wallet has no custody.</strong> Our server account
                can release a failed escrow early, but it cannot redirect the
                funds &mdash; only the user's chosen charity can ever receive
                them.
              </span>
            </li>
            <li>
              <span>
                <strong>No cron, no daemon.</strong> Each list-goals call lazily
                expires the user's own past-window bets, so stakes still make it
                to charity even without a scheduled job.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="docs-section">
        <div className="section-title">Stack</div>
        <div className="box">
          <div className="docs-chips">
            <span className="badge">React 19</span>
            <span className="badge">Vite</span>
            <span className="badge">Next.js</span>
            <span className="badge">MongoDB</span>
            <span className="badge">bcrypt</span>
            <span className="badge">XRPL testnet</span>
            <span className="badge">xrpl.js</span>
            <span className="badge">Google GenAI (Gemma)</span>
            <span className="badge">EXIF / GPS</span>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <div className="section-title">Verification signals</div>
        <div className="box">
          <div className="docs-kv">
            <div className="k">EXIF time</div>
            <div className="v">
              Capture timestamp must fall inside the goal's
              <code>targetAt &plusmn; windowMinutes</code>.
            </div>
            <div className="k">GPS</div>
            <div className="v">
              Photo coordinates must be within the goal's
              <code>radiusMeters</code> of the chosen location.
            </div>
            <div className="k">Vision (optional)</div>
            <div className="v">
              Gemma is asked, in strict JSON, whether the image plausibly shows
              the goal scene. Advisory only &mdash; never blocks resolution.
            </div>
            <div className="k">Outcome</div>
            <div className="v">
              All required signals must pass for the goal to resolve as
              <code> succeeded</code>. Otherwise it stays
              <code> active</code> until the window closes.
            </div>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <div className="section-title">Honest demo notes</div>
        <div className="docs-callout">
          <strong>Hackathon caveat.</strong> All demo users currently share a
          single XRPL testnet wallet, and the preset charities point at the
          same testnet address. The architecture supports per-user keys and
          distinct charity wallets &mdash; we just kept the demo wiring simple.
        </div>
      </section>
    </div>
  );
}

export default Docs;
