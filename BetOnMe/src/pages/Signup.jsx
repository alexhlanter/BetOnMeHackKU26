import './Signup.css'
import { Link } from "react-router-dom";

function SignUp() {
    return (
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh"}}>
            <h1>Bet On Yourself!</h1>
            <p>Username</p>
            <input
                type="text"
                placeholder="Your username..."
                style={{margin: "10px", padding: "10px", width: "300px"}}
            />

            <p>Password</p>
            <input
                type="text"
                placeholder="A good password..."
                style={{margin: "10px", padding: "10px", width: "300px"}}
            />

            <button style={{marginTop: "10px", padding: "10px 30px"}}>
                Get Started
            </button>
            <p className="requisites">**Password Requirements**</p>

        </div>
    );
}

export default SignUp;