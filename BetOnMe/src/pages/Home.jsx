import "./Home.css";

function Home() {
  return (
    <div className="home-container">
    <h2 className='title'>BetOnMe</h2>
      {/* LEFT SIDE */}
      <div className="left">
        
        <div className="box goal">
          <h2>Current Bet</h2>
          <p>Finish studying React fundamentals</p>
        </div>

        <div className="box week">
          <h3>Weekly View</h3>
          <p>Mon - Sun progress tracker goes here</p>
        </div>

      </div>

      {/* RIGHT SIDE */}
      <div className="right">

        <div className="box add">
          <h3>Add Bet</h3>
          <button>Add +</button>
        </div>

        <div className="box ratio">
          <h3>Current Streak</h3>
          <p>0 bet streak...</p>
        </div>

      </div>

    </div>
  );
}
export default Home;