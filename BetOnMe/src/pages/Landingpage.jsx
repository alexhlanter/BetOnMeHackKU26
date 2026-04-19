import "./Landingpage.css";
import addbet from '../assets/addbet.png';
import progress from '../assets/progress.png';
import weekview from '../assets/weekview.png';

export default function Landing() {
  return (
    <div className="lp">

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
        <div className="site-title">BetOnMe</div>
        <h1 className="headline">Real Steps, Real Stakes</h1>
        <p className="subtext">
          Put your money where your mind is. Use BetOnMe to make bets on yourself towards goals
          that matter to you. Stash away some money and gather it back as a reward once you've completed your goal.
          Fail your goal? Don't worry, your money goes towards a charitable foundation of your choice. Building accountability and good habits.
        </p> 
        <p className='subtext'>Win-win.</p>
        <p> </p>
        <br></br>
        <br></br>
        <br></br>
        <br></br>
        <br></br>
        </div>
      </section>

      {/* Photo + description section */}
      <section className="photos-section">
        <div className="photos-grid">
          <div className="photo-card">
            <img src={addbet} alt="add a bet" className="photo-img" />
            <h3>Add a bet</h3>
            <p>Choose your goal, focus, and check in when you're done.</p>
          </div>
          <div className="photo-card">
            <img src={progress} alt="add a bet" className="photo-img" />
            <h3>Prove yourself right</h3>
            <p>Keep track of how many goals you've completed in a row and your record.</p>
          </div>
          <div className="photo-card">
            <img src={weekview} alt="add a bet" className="photo-img" />
            <h3>Track your habits</h3>
            <p>Complete your goal, get paid back.</p>
            </div>
        </div>
      </section>

      {/* Additional info section */}
      <section className="contact-section">
        <h2>More Information For You</h2>
            <ul>
                <li>Your stake is locked on the XRP Ledger when you commit to a goal</li>
                <li>Money goes back to you if you succeed, or to charity if you fail</li>
                <li><strong>Commit:</strong> A time-bounded escrow is created with your chosen charity hard-wired as the destination</li>
                <li><strong>Resolve:</strong> Upload proof before your window closes to mark a win — miss it and funds auto-release to charity</li>
                <li><strong>Refund:</strong> After the 24-hour deadline, successful users can claim their stake back to their wallet</li>
                <li>BetOnMe acts as a referee, not a bank — it can never change where your money goes</li>
                <li>Blockchain executes first — XRPL transactions happen before our database even updates</li>
                <li>Goal state and chain state are kept separate, so you can batch refunds on your own schedule</li>
            </ul>
      </section>
    </div>
  );
}