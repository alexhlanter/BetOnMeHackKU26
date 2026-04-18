import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Bets from "./pages/Bets";
import Profile from "./pages/Profile";
import SignIn from "./pages/Sign-in";
import { AuthProvider } from "./lib/AuthContext";
import { DevModeProvider } from "./lib/DevModeProvider";
import SignUp from "./pages/Signup";
import Landingpage from "./pages/Landingpage";
import Docs from "./pages/Docs";

function App() {
  return (
    <DevModeProvider>
      <AuthProvider>
        <BrowserRouter basename="/app">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Landingpage />} />
              <Route path="home" element={<Home />} />
              <Route path="bets" element={<Bets />} />
              <Route path="docs" element={<Docs />} />
              <Route path="profile" element={<Profile />} />
              <Route path="sign-in" element={<SignIn />} />
              <Route path="signup" element={<SignUp />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </DevModeProvider>
  );
}

export default App;
