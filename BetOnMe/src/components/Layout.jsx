import Navbar2 from "./Navbar2"; /*import Navbar from "./Navbar"; */
import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div>
      <Navbar2 />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;