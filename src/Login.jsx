import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile, // 🆕 Firebase Profile update karne ke liye add kiya
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore"; // 🆕 Database update ke liye add kiya
import app from "./firebase";

const auth = getAuth(app);
const db = getFirestore(app); // 🆕 Firestore database connect kiya

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const validateForm = () => {
    setError("");
    if (!email) {
      setError("Email is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!password) {
      setError("Password is required.");
      return false;
    }
    if (isRegistering && password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }
    return true;
  };

  const signInWithEmail = async () => {
    setMessage("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("Login successful!");
      navigate("/dashboard");
    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // 👑 UPDATE: Naye user ka naam blank rakhne ka aur logic setup karne ka function
  const registerWithEmail = async () => {
    setMessage("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 1. Display name ko intentionally BLANK chhod diya
      await updateProfile(user, {
        displayName: ""
      });

      // 2. Database (Firestore) mein user ka document banaya jahan naam "" hai
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        name: "", // 👈 Shuruat mein naam khali rahega
        roomCode: "",
        role: "Roommate",
        createdAt: Date.now()
      });

      setMessage("Registration successful! Redirecting to dashboard...");
      
      // Data set hote hi direct user ko dashboard par bhej denge taaki wo apna naam daal sake
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);

    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setMessage("");
    setError("");
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent!");
    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getFirebaseErrorMessage = (error) => {
    switch (error.code) {
      case "auth/invalid-email": return "Invalid email address format.";
      case "auth/user-not-found": return "No user found with this email.";
      case "auth/wrong-password": return "Incorrect password.";
      case "auth/email-already-in-use": return "This email is already registered.";
      default: return "An error occurred. Please try again.";
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-[1100px] bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-[#0d3d3a] flex flex-col md:flex-row h-auto md:h-[680px]">
        
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-between relative">
          
          <div className="flex items-center space-x-2 mb-8 md:mb-0">
            <div className="flex flex-col space-y-1">
              <span className="w-6 h-[3px] bg-[#1d4ed8] rounded"></span>
              <span className="w-6 h-[3px] bg-[#0d9488] rounded"></span>
              <span className="w-4 h-[3px] bg-[#0d9488] rounded"></span>
            </div>
            <span className="text-2xl font-bold text-[#1e293b]">Roomiee</span>
          </div>

          <div className="max-w-[380px] w-full mx-auto my-auto">
            <h1 className="text-[#1e1b4b] text-4xl font-extrabold tracking-tight mb-2">
              {isRegistering ? "Create Account" : "Welcome Back!"}
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              {isRegistering ? "Please fill in the details." : "Please Log in to your account."}
            </p>

            {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
            {message && <p className="text-green-600 text-xs mb-4">{message}</p>}

            <div className="space-y-4">
              <div className="relative">
                <label className="absolute -top-2 left-4 bg-white px-1 text-xs text-gray-400">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-300 text-gray-800 text-sm focus:outline-none focus:border-[#0d9488]"
                  disabled={loading}
                />
              </div>

              <div className="relative flex items-center">
                <label className="absolute -top-2 left-4 bg-white px-1 text-xs text-gray-400 z-10">
                  Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={isRegistering ? "" : "•••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 rounded-xl border border-gray-300 text-gray-800 text-sm focus:outline-none focus:border-[#0d9488] tracking-widest placeholder-gray-300"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {!isRegistering && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center space-x-2 text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-gray-300 text-[#0d9488] focus:ring-[#0d9488]"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-red-400 font-semibold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-4 pt-4">
                <button
                  onClick={isRegistering ? registerWithEmail : signInWithEmail}
                  className="flex-1 bg-[#115e59] hover:bg-[#0f4c48] text-white py-3 rounded-xl font-bold text-sm transition-colors"
                  disabled={loading}
                >
                  {loading ? "Processing..." : isRegistering ? "Sign Up" : "Login"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError("");
                    setMessage("");
                  }}
                  className="flex-1 bg-white border border-[#115e59] text-[#115e59] hover:bg-gray-50 py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  {isRegistering ? "Back to Login" : "Create account"}
                </button>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 leading-normal max-w-[340px] mt-8 md:mt-0">
            By signing up you agree to our <span className="underline cursor-pointer">term</span> and that you have read our <span className="underline cursor-pointer">data policy</span>
          </div>
        </div>

        <div className="w-full md:w-1/2 h-64 md:h-full relative overflow-hidden bg-cover bg-center" 
             style={{ backgroundImage: `url('https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000')` }}>
          
          <div className="absolute inset-0 bg-[#062c29]/10 mix-blend-multiply"></div>
          
          <div className="absolute top-1/2 -left-5 transform -translate-y-1/2 hidden md:flex z-10">
            <button className="bg-[#f59e0b] text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg focus:outline-none">
              <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>

          <div className="absolute bottom-6 right-6 bg-white rounded-lg px-3 py-1 flex items-center space-x-2 text-xs font-bold text-gray-800 shadow">
            <span>1</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Login;