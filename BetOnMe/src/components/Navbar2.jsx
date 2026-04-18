import { NavLink } from "react-router-dom";
import "./Navbar2.css";

function Navbar2() {
  return (
    <nav style={{ padding: "10px", background: "#1e293b"}}>
      <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Home </NavLink>
      <NavLink to="/bets" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Bets </NavLink>
      <NavLink to="/profile" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Profile </NavLink>
      <NavLink to="/sign-in" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Sign-In </NavLink>
  </nav> 
  );
}

export default Navbar2;