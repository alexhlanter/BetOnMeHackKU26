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

            <p className="requisites">**Password Requirements**</p>
            <p className="rules">-Password must be 8 characters long. <br/>-Must contain use of at least one special character and one number</p>
            
            <button style={{marginTop: "10px", padding: "10px 30px"}}>
                Get Started
            </button>
            
        </div>
    );
}

export default SignUp;