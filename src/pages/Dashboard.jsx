import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword, updateProfile, getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion, collection, addDoc, query, where, onSnapshot, deleteDoc, getFirestore } from "firebase/firestore";
import app from "../firebase"; // Your firebase config path
import { GoogleGenAI } from "@google/genai"; // Gemini AI SDK

const auth = getAuth(app);
const db = getFirestore(app);

// 👑 SUPER ADMIN CONFIGURATION
const SUPER_ADMIN_UID = "ZOp4VHe1vzg3NJXn0E1LGWq7rS42"; 

// 🤖 GEMINI AI CONFIGURATION (FRONTEND COMPATIBLE WITH BROWSER ALLOWED)
const ai = new GoogleGenAI({ 
  apiKey: "AIzaSyAXKeYp8tKQywx5ob4_0YxMO7H8eU8mWaU",
  dangerouslyAllowBrowser: true // Bypasses browser restriction blocks
});

function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  // Responsive Sidebar Toggle State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tabs & General States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState("May 2026");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [roomMembersCount, setRoomMembersCount] = useState(1);
  const [currentUserId, setCurrentUserId] = useState(auth.currentUser?.uid || null);

  // Super Admin Access Check
  const isSuperAdmin = currentUserId === SUPER_ADMIN_UID;

  // Expense Form States
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  // Room Management States
  const [roomName, setRoomName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [myRoomCode, setMyRoomCode] = useState("");
  const [myRoomName, setMyRoomName] = useState("");

  // Chatbot States (Pure English Mode)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false); 
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: "bot", text: "Hello! I am your Roomies AI Assistant. I have live access to your expense records. Feel free to ask me any calculation or breakdown queries!", time: "Just now" }
  ]);

  // Profile States
  const [profile, setProfile] = useState({
    name: auth.currentUser?.displayName || "", 
    email: auth.currentUser?.email || "",
    avatar: "",
    role: "User"
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [settings, setSettings] = useState({
    notifications: true,
    currency: "INR",
  });

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);

  // QR Code Canvas Logic
  useEffect(() => {
    if (!myRoomCode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0d9488";
    ctx.fillRect(10, 10, 35, 35);
    ctx.fillRect(15, 15, 25, 25);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(20, 20, 15, 15); ctx.fillStyle = "#0d9488";
    
    ctx.fillRect(105, 10, 35, 35);
    ctx.fillRect(110, 15, 25, 25);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(115, 20, 15, 15); ctx.fillStyle = "#0d9488";

    ctx.fillRect(10, 105, 35, 35);
    ctx.fillRect(15, 110, 25, 25);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(20, 115, 15, 15); ctx.fillStyle = "#0d9488";

    let hash = 0;
    for (let i = 0; i < myRoomCode.length; i++) {
      hash = myRoomCode.charCodeAt(i) + ((hash << 5) - hash);
    }

    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if ((row < 5 && col < 5) || (row < 5 && col > 9) || (row > 9 && col < 5)) continue;
        const bit = (hash >> (row + col)) & 1;
        if (bit === 1 || (row * col) % 3 === 0) {
          ctx.fillRect(15 + col * 8, 15 + row * 8, 6, 6);
        }
      }
    }
  }, [myRoomCode, activeTab]);

  // Auth Status Observer
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  // Firebase Firestore Profile Loader
  useEffect(() => {
    if (!currentUserId) return;

    const userDocRef = doc(db, "users", currentUserId);
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.roomCode) {
          setMyRoomCode(userData.roomCode);
          setMyRoomName(userData.roomName || "My Group");
        }
        setProfile(prev => ({
          ...prev,
          name: userData.name || "", 
          avatar: userData.avatar || prev.avatar,
          role: isSuperAdmin ? "Super Admin" : (userData.role || "Roommate")
        }));
      }
    });
  }, [currentUserId, isSuperAdmin]);

  // Room Members Observer
  useEffect(() => {
    if (!myRoomCode || isSuperAdmin) return;

    const roomDocRef = doc(db, "rooms", myRoomCode);
    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data();
        if (roomData.members) {
          setRoomMembersCount(roomData.members.length);
        }
      }
    });

    return () => unsubscribe();
  }, [myRoomCode, isSuperAdmin]);

  // Realtime Expenses Observer
  useEffect(() => {
    let q;
    if (isSuperAdmin) {
      q = collection(db, "expenses"); 
    } else {
      if (!myRoomCode) { setExpenses([]); return; }
      q = query(collection(db, "expenses"), where("roomCode", "==", myRoomCode));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const expensesData = [];
      querySnapshot.forEach((doc) => {
        expensesData.push({ id: doc.id, ...doc.data() });
      });
      expensesData.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(expensesData);
    });

    return () => unsubscribe();
  }, [myRoomCode, isSuperAdmin]);

  // 🤖 LIVE GEMINI AI PROCESSING (Strict English System Instructions)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setChatMessages(prev => [...prev, { id: Date.now(), sender: "user", text: userMessage, time: timestamp }]);
    setChatInput("");
    setIsTyping(true); 

    try {
      const currentExpensesContext = expenses.map(exp => 
        `Item: ${exp.title}, Amount: ₹${exp.amount}, Category: ${exp.category}, Paid By: ${exp.addedBy || "Unknown"}, Date: ${exp.date}`
      ).join("\n");

      const systemPrompt = `You are Roomies AI, an expert dashboard manager. You must respond strictly in standard English language. Use the live data provided below to answer user inquiries clearly, objectively, and accurately.
      
      Live Operational Dataset:
      ${currentExpensesContext || "No expense records are currently stored."}
      
      User Query: ${userMessage}`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash', // Switched to stable browser-friendly endpoint
        contents: systemPrompt,
      });

      const botReply = response.text || "I am unable to interpret that entry. Please try again.";
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: "bot", text: botReply, time: timestamp }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: "bot", text: "Connection Error: Please ensure network accessibility or verify API limits on Google Studio.", time: timestamp }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount || parseFloat(amount) <= 0 || !category) {
      alert("Please fill all fields correctly!");
      return;
    }
    if (!myRoomCode && !isSuperAdmin) {
      alert("Please create or join a room first!");
      return;
    }

    try {
      const today = new Date();
      const formattedDate = today.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });

      await addDoc(collection(db, "expenses"), {
        title: title.trim(),
        amount: parseFloat(amount),
        category: category,
        roomCode: isSuperAdmin ? "GLOBAL_ADMIN" : myRoomCode,
        addedBy: profile.name || "Anonymous User",
        addedById: currentUserId,
        date: formattedDate,
        createdAt: Date.now()
      });

      setTitle("");
      setAmount("");
      setIsModalOpen(false);
    } catch (err) {
      alert("Error adding expense: " + err.message);
    }
  };

  const handleDeleteExpense = async (expenseId, addedById) => {
    if (!isSuperAdmin && addedById !== currentUserId) {
      alert("You can only delete your own expenses!");
      return;
    }
    if (window.confirm("Are you sure you want to delete this expense?")) {
      try {
        await deleteDoc(doc(db, "expenses", expenseId));
      } catch (err) {
        alert("Error deleting expense: " + err.message);
      }
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await setDoc(doc(db, "rooms", generatedCode), {
        roomName: roomName.trim(),
        createdBy: currentUserId,
        createdAt: Date.now(),
        members: arrayUnion(currentUserId)
      });
      await setDoc(doc(db, "users", currentUserId), {
        roomCode: generatedCode,
        roomName: roomName.trim(),
        role: "Admin"
      }, { merge: true });

      setMyRoomCode(generatedCode);
      setMyRoomName(roomName.trim());
      setProfile(prev => ({ ...prev, role: "Admin" }));
      setRoomName("");
      setProfileMessage("Room Created Successfully!");
    } catch (err) {
      setProfileError("Error creating room: " + err.message);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    const upperCode = inviteCodeInput.trim().toUpperCase();
    try {
      const roomDocRef = doc(db, "rooms", upperCode);
      const roomSnap = await getDoc(roomDocRef);

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        await updateDoc(roomDocRef, { members: arrayUnion(currentUserId) });
        await setDoc(doc(db, "users", currentUserId), {
          roomCode: upperCode,
          roomName: roomData.roomName,
          role: "Roommate"
        }, { merge: true });

        setMyRoomCode(upperCode);
        setMyRoomName(roomData.roomName);
        setProfile(prev => ({ ...prev, role: "Roommate" }));
        setInviteCodeInput("");
        setProfileMessage(`Successfully joined ${roomData.roomName}!`);
      } else {
        setProfileError("Invalid Code. Room data record not found.");
      }
    } catch (err) {
      setProfileError("Error establishing connection with the selected room.");
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        setProfile({ ...profile, avatar: reader.result });
        await setDoc(doc(db, "users", currentUserId), { avatar: reader.result }, { merge: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      alert("Name parameters cannot be left blank!"); return;
    }
    try {
      if (auth.currentUser && currentUserId) {
        await updateProfile(auth.currentUser, { displayName: profile.name.trim() });
        await setDoc(doc(db, "users", currentUserId), { name: profile.name.trim() }, { merge: true });
      }
      setProfileMessage("Profile records verified and updated successfully!");
    } catch (err) {
      setProfileError("Failed to synchronization profile name.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setProfileError("Passwords matching evaluation failed!");
      return;
    }
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setProfileMessage("Security access key modified successfully!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setProfileError("Failed to update password configuration. Please log in again and retry.");
    }
  };

  // Calculations
  const roomTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const perHeadShare = roomMembersCount > 0 ? roomTotal / roomMembersCount : 0;
  const myPaidTotal = expenses.filter(exp => exp.addedById === currentUserId).reduce((sum, exp) => sum + Number(exp.amount), 0);

  const memberBalances = {};
  expenses.forEach(exp => {
    const name = exp.addedBy || "Unknown Member";
    memberBalances[name] = (memberBalances[name] || 0) + Number(exp.amount);
  });

  const getSettlementMatrix = () => {
    let debtors = []; let creditors = [];
    Object.keys(memberBalances).forEach(name => {
      const net = memberBalances[name] - perHeadShare;
      if (net < 0) debtors.push({ name, owes: Math.abs(net) });
      else if (net > 0) creditors.push({ name, gets: net });
    });
    let transactions = []; let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      let debtor = debtors[i]; let creditor = creditors[j];
      let amountToPay = Math.min(debtor.owes, creditor.gets);
      transactions.push({ from: debtor.name, to: creditor.name, amount: amountToPay });
      debtor.owes -= amountToPay; creditor.gets -= amountToPay;
      if (debtor.owes === 0) i++; if (creditor.gets === 0) j++;
    }
    return transactions;
  };

  const exportToPDF = () => {
    if (expenses.length === 0) {
      alert("No database record metrics available for export!"); return;
    }
    try {
      const { jsPDF } = window.jspdf;
      const pdfDoc = new jsPDF();
      pdfDoc.text(`${myRoomName || "Roomies"} Expense Ledger Summary - ${selectedMonth}`, 14, 15);
      pdfDoc.text(`Total Aggregation: INR ${roomTotal.toFixed(2)}`, 14, 23);
      pdfDoc.text(`Divided Core Share: INR ${perHeadShare.toFixed(2)} (Active Size: ${roomMembersCount})`, 14, 29);
      
      const tableRows = expenses.map(exp => [
        exp.title, exp.category, `INR ${Number(exp.amount).toFixed(2)}`, exp.addedBy || "Member", exp.date || "N/A"
      ]);

      pdfDoc.autoTable({
        head: [["Description", "Category", "Amount", "Authorized By", "Timestamp"]],
        body: tableRows, startY: 36,
      });

      pdfDoc.save(`Expense_Statement_${selectedMonth.replace(/\s+/g, "_")}.pdf`);
    } catch (error) { alert("Initialization parameter failure within PDF rendering instance."); }
  };

  const exportToCSV = () => {
    if (expenses.length === 0) {
      alert("No data available to export!"); return;
    }
    try {
      const headers = ["Description", "Category", "Amount (INR)", "Added By", "Date"];
      const rows = expenses.map(exp => [
        `"${exp.title.replace(/"/g, '""')}"`, `"${exp.category}"`, exp.amount, `"${exp.addedBy || "Member"}"`, `"${exp.date || "N/A"}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Expense_Report_${selectedMonth.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) { alert("An error occurred during localized dataset compilation."); }
  };

  const navToTab = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans text-gray-700 select-none relative overflow-x-hidden">
      
      {/* MOBILE TOP NAVIGATION BAR */}
      <div className="md:hidden flex items-center justify-between bg-white px-5 py-4 border-b border-gray-100 sticky top-0 z-40 w-full">
        <div>
          <h1 className="text-lg font-bold text-[#0d9488] tracking-tight">Roomies</h1>
          <p className="text-[10px] text-gray-400">{myRoomName ? `${myRoomName}` : "No Active Space Instance"}</p>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600 focus:outline-none text-xl font-bold">
          {isSidebarOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* BACKDROP FOR MOBILE SIDEBAR */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 md:hidden" />}

      {/* SIDEBAR */}
      <div className={`fixed top-0 bottom-0 left-0 z-50 w-[260px] bg-white border-r border-gray-100 flex flex-col justify-between p-6 transition-transform duration-300 md:translate-x-0 md:sticky md:h-screen shrink-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div>
          <div className="mb-6 hidden md:block">
            <h1 className="text-xl font-bold text-[#0d9488] tracking-tight">Roomies</h1>
            <p className="text-xs text-gray-400 mt-0.5">{isSuperAdmin ? "👑 Master Administration View" : (myRoomName ? `${myRoomName} ▾` : "No Selected Space ▾")}</p>
            {myRoomCode && !isSuperAdmin && (
              <div className="space-y-1 mt-1">
                <p className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded inline-block font-mono font-bold">Code: {myRoomCode}</p>
                <p className="text-[10px] text-teal-600 block font-semibold">👥 {roomMembersCount} Active Members</p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-full bg-[#0d9488]/20 flex items-center justify-center font-bold text-[#0d9488]">
              {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold text-gray-800 leading-tight truncate w-[130px]">
                {profile.name && profile.name.trim() !== "" ? profile.name : "Guest Session"}
              </h4>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium inline-block mt-0.5 ${isSuperAdmin ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                @{profile.role.toLowerCase()}
              </span>
            </div>
          </div>

          <nav className="space-y-1 mb-4">
            <button onClick={() => navToTab("dashboard")} className={`w-full text-left flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === "dashboard" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Dashboard</span></button>
            <button onClick={() => navToTab("expenses")} className={`w-full text-left flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === "expenses" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Room Expenses</span></button>
            <button onClick={() => navToTab("settlements")} className={`w-full text-left flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === "settlements" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Settlements</span></button>
            <button onClick={() => navToTab("profile")} className={`w-full text-left flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === "profile" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>My Profile</span></button>
            <button onClick={() => navToTab("settings")} className={`w-full text-left flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === "settings" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Settings</span></button>
          </nav>
        </div>

        <div className="space-y-1 pt-2 border-t border-gray-100">
          <button onClick={() => { if(window.confirm("Confirm account log out request?")) navigate("/"); }} className="w-full flex items-center space-x-3 px-4 py-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs font-medium transition-colors text-left">
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto h-auto md:h-screen pb-24 w-full">
        
        {/* BANNER FOR BLANK PROFILE NAME HANDLING */}
        {(!profile.name || profile.name.trim() === "") && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-amber-800">Profile Configuration Incomplete</h4>
              <p className="text-xs text-amber-600">Please provide your Full Name to validate database tracking metrics across workspace fields.</p>
            </div>
            <button onClick={() => navToTab("profile")} className="bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">Complete Profile</button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 capitalize">
            {activeTab === "expenses" ? "Room Expenses" : activeTab === "profile" ? "My Profile" : activeTab}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setIsModalOpen(true)} className="bg-[#0d9488] hover:bg-[#0b7a70] text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
              + Add Expense
            </button>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm focus:outline-none">
              <option value="May 2026">May 2026</option>
            </select>
            <button onClick={exportToPDF} className="bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-gray-50 shadow-sm">PDF</button>
            <button onClick={exportToCSV} className="bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-[#0d9488]/20 shadow-sm">CSV</button>
          </div>
        </div>
        
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {!myRoomCode && !isSuperAdmin && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row gap-2 justify-between sm:items-center">
                <span>No active workspace group detected. Access your user profile parameters to link/generate a Room configuration.</span>
                <button onClick={() => setActiveTab("profile")} className="bg-amber-600 text-white px-3 py-1 rounded-lg text-[11px] self-start sm:self-auto shrink-0">Setup Room</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-xs font-semibold text-gray-400">Personal Contribution Total</span>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">₹{myPaidTotal.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-xs font-semibold text-gray-400">Workspace Aggregate Total</span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#0d9488] mt-1">₹{roomTotal.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-xs font-semibold text-gray-400">Per Head Share Split</span>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">₹{perHeadShare.toFixed(2)}</h3>
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h4 className="text-sm font-bold text-gray-800 mb-4">Roommates Summary Analytics</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(memberBalances).length === 0 ? (
                  <p className="text-xs text-gray-400">No analytical metric records saved.</p>
                ) : (
                  Object.keys(memberBalances).map((name) => {
                    const paid = memberBalances[name];
                    const net = paid - perHeadShare;
                    return (
                      <div key={name} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                        <h5 className="text-xs font-bold text-gray-800">{name}</h5>
                        <div className="flex justify-between text-[11px] mt-2 text-gray-500">
                          <span>Total Contributed:</span> <span className="font-bold">₹{paid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] mt-1">
                          <span>Status Node:</span>
                          <span className={`font-bold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {net >= 0 ? `Receives back ₹${net.toFixed(2)}` : `Owes balance of ₹${Math.abs(net).toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h4 className="text-sm font-bold text-gray-800 mb-4">Comprehensive Core Ledger Log</h4>
              <div className="overflow-x-auto w-full inline-block align-middle">
                <div className="min-w-[600px] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="pb-3 font-semibold">Description</th>
                        <th className="pb-3 font-semibold">Category Type</th>
                        <th className="pb-3 font-semibold">Logged By</th>
                        <th className="pb-3 font-semibold">Timestamp</th>
                        <th className="pb-3 font-semibold text-right">Net Value</th>
                        <th className="pb-3 text-center">Action Node</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-4 text-gray-400">No historical data logs tracked.</td></tr>
                      ) : (
                        expenses.map((exp) => (
                          <tr key={exp.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50/50">
                            <td className="py-3 font-medium text-gray-800 capitalize">{exp.title}</td>
                            <td className="py-3 text-gray-500"><span className="bg-gray-100 px-2 py-0.5 rounded-full">{exp.category}</span></td>
                            <td className="py-3 text-gray-700 font-semibold">{exp.addedBy || "—"}</td>
                            <td className="py-3 text-gray-400">{exp.date || "N/A"}</td>
                            <td className="py-3 font-bold text-gray-800 text-right">₹{Number(exp.amount).toFixed(2)}</td>
                            <td className="py-3 text-center">
                              {(isSuperAdmin || exp.addedById === currentUserId) ? (
                                <button onClick={() => handleDeleteExpense(exp.id, exp.addedById)} className="text-red-500 hover:text-red-700 font-bold px-2 py-0.5 rounded hover:bg-red-50">Delete</button>
                              ) : (
                                <span className="text-gray-300 text-[10px] italic">Locked Parameter</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-sm font-bold text-gray-800 mb-6">Room Expenses Dynamic Statement ({myRoomName || "Unlinked Block"})</h4>
            <div className="overflow-x-auto w-full">
              <div className="min-w-[550px]">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 text-xs">
                      <th className="pb-3 font-semibold">Description</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold">Paid Source</th>
                      <th className="pb-3 font-semibold">Date Input</th>
                      <th className="pb-3 font-semibold text-right">Value Metric</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50/50">
                        <td className="py-3 font-medium text-gray-800 capitalize">{exp.title}</td>
                        <td className="py-3 text-gray-500 text-xs"><span className="bg-gray-100 px-2 py-0.5 rounded-full">{exp.category}</span></td>
                        <td className="py-3 text-gray-700 text-xs font-semibold">{exp.addedBy || "Member"}</td>
                        <td className="py-3 text-gray-400 text-xs">{exp.date || "N/A"}</td>
                        <td className="py-3 font-bold text-gray-800 text-right">₹{Number(exp.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settlements" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 lg:col-span-7 shadow-sm">
              <h4 className="text-sm font-bold text-gray-800 mb-1">Workspace Allocation Ratio</h4>
              <p className="text-xs text-gray-400 mb-4">Aggregate Value: ₹{roomTotal.toFixed(2)} | Normalized Share Split: ₹{perHeadShare.toFixed(2)}</p>
              <div className="space-y-3">
                {Object.keys(memberBalances).length === 0 ? (
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-xs font-semibold text-center">No structural parameters detected.</div>
                ) : (
                  Object.keys(memberBalances).map((name) => {
                    const paid = memberBalances[name];
                    const net = paid - perHeadShare;
                    return (
                      <div key={name} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border border-gray-100 rounded-xl bg-gray-50/50 gap-2">
                        <div>
                          <h5 className="text-xs font-bold text-gray-800">{name}</h5>
                          <p className="text-[11px] text-gray-400">Total Spent Metrics: ₹{paid.toFixed(2)}</p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-lg self-start sm:self-auto ${net >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {net >= 0 ? `Receives back: ₹${net.toFixed(2)}` : `Owes balance: ₹${Math.abs(net).toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 lg:col-span-5 shadow-sm">
              <h4 className="text-sm font-bold text-gray-800 mb-1">Transactional Allocation Engine</h4>
              <p className="text-xs text-gray-400 mb-4">Localized balance evaluations.</p>
              <div className="space-y-3">
                {roomTotal === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No parameters found to calculate matrix execution paths.</p>
                ) : getSettlementMatrix().length === 0 ? (
                  <div className="bg-green-50 text-green-800 p-4 rounded-xl text-xs font-semibold text-center">🎉 Workspace matrix parameters successfully squared away!</div>
                ) : (
                  getSettlementMatrix().map((tx, idx) => (
                    <div key={idx} className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs leading-relaxed">
                      <span className="font-bold text-red-600">{tx.from}</span> transfers <span className="font-bold text-green-700">₹{tx.amount.toFixed(2)}</span> to internal node <span className="font-bold text-teal-800">{tx.to}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Initialize Workspace Node</h4>
                <form onSubmit={handleCreateRoom} className="space-y-3">
                  <input type="text" placeholder="e.g. Unit Suite 4" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none" required />
                  <button type="submit" className="bg-[#0d9488] text-white px-4 py-2 rounded-xl text-xs font-bold w-full">Generate Access Reference Code</button>
                </form>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Link External Workspace Instance</h4>
                <form onSubmit={handleJoinRoom} className="space-y-3">
                  <input type="text" placeholder="Insert Token Code" value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 uppercase tracking-wider focus:outline-none" required />
                  <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold w-full">Sync with Reference Block</button>
                </form>
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center col-span-1 sm:col-span-2 lg:col-span-1">
                {myRoomCode ? (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-gray-800">Scan Matrix Token</h5>
                    <div className="bg-white p-2 border border-gray-100 rounded-xl shadow-xs inline-block">
                      <canvas ref={canvasRef} width="130" height="130" className="mx-auto" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md inline-block">Token Key: {myRoomCode}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-300 text-center p-4">
                    <div className="text-2xl mb-1">🔳</div>
                    <p className="text-[11px] max-w-[160px]">Create or join a space instance to generate localized QR configurations.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-7 space-y-6">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Identity Parameter Settings</h4>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Full Identity Name</label>
                    <input type="text" value={profile.name || ""} placeholder="Enter your full legal profile name..." onChange={(e) => setProfile({...profile, name: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Email Endpoint (Protected Fields)</label>
                    <input type="email" value={profile.email} className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-400 cursor-not-allowed focus:outline-none" readOnly />
                  </div>
                  <button type="submit" className="bg-[#0d9488] text-white px-4 py-2 rounded-xl text-xs font-bold">Commit Profile Parameter Updates</button>
                </form>

                <hr className="border-gray-100" />

                <h4 className="text-sm font-bold text-gray-800 mb-1">Security Access Overrides</h4>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">New Access Token Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none" placeholder="Minimum length of 6 tokens" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Confirm Security Token Match</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none" required />
                  </div>
                  <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold">Modify Cryptographic Key</button>
                </form>

                {profileMessage && <p className="text-xs text-green-600 font-semibold bg-green-50 p-3 rounded-xl">{profileMessage}</p>}
                {profileError && <p className="text-xs text-red-500 font-semibold bg-red-50 p-3 rounded-xl">{profileError}</p>}
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-5 flex flex-col items-center text-center space-y-4">
                <h4 className="text-sm font-bold text-gray-800 self-start">Visual Token Avatar</h4>
                {profile.avatar ? (
                  <img src={profile.avatar} alt="Profile Source" className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-[#0d9488]/30 shadow-sm" />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#0d9488]/10 text-[#0d9488] font-bold text-2xl sm:text-3xl flex items-center justify-center border-2 border-dashed border-[#0d9488]/30">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-[#0d9488] bg-[#0d9488]/10 hover:bg-[#0d9488]/20 px-4 py-2 rounded-xl transition-colors">
                  Upload Asset Stream
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm max-w-2xl space-y-6">
            <div>
              <h4 className="text-sm font-bold text-gray-800">Preferences Profile</h4>
              <p className="text-xs text-gray-400">Configure workspace rendering structures.</p>
            </div>
            <hr className="border-gray-100" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <h5 className="text-xs font-bold text-gray-800">Email Pipeline Logs</h5>
                <p className="text-[11px] text-gray-400 max-w-[200px] sm:max-w-none">Receive system analytics summaries detailing internal ledger variations.</p>
              </div>
              <input type="checkbox" checked={settings.notifications} onChange={(e) => setSettings({...settings, notifications: e.target.checked})} className="accent-[#0d9488] shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h5 className="text-xs font-bold text-gray-800">Locale Target Currency Symbol</h5>
                <p className="text-[11px] text-gray-400">Base internationalization parameters mapping tool.</p>
              </div>
              <select value={settings.currency} onChange={(e) => setSettings({...settings, currency: e.target.value})} className="bg-gray-50 border border-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none shrink-0">
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 🤖 FLOATING CHATBOT WIDGET WITH LIVE GEMINI AI PROCESSING */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end max-w-[calc(100vw-32px)]">
        {isChatOpen && (
          <div className="w-72 sm:w-80 h-80 sm:h-96 bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col overflow-hidden mb-3">
            <div className="bg-[#0d9488] text-white px-4 py-3 flex justify-between items-center shrink-0">
              <div>
                <h4 className="text-xs font-bold">Roomies Gemini AI</h4>
                <p className="text-[10px] text-teal-100">Live Workspace Analyzer Instance</p>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-teal-200 text-lg font-bold">×</button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-gray-50 text-xs">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl ${msg.sender === "user" ? "bg-[#0d9488] text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"}`}>
                    <p className="leading-relaxed break-words">{msg.text}</p>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-0.5 px-1">{msg.time}</span>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex flex-col items-start">
                  <div className="bg-white text-gray-400 border border-gray-100 px-3 py-2 rounded-xl rounded-tl-none italic animate-pulse">
                    Gemini processing active dataset parameters...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-2 bg-white border-t border-gray-100 flex items-center space-x-1 shrink-0">
              <input type="text" placeholder="Ask Gemini about active system analytics..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0d9488]" disabled={isTyping} />
              <button type="submit" className="bg-[#0d9488] hover:bg-[#0b7a70] text-white px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50" disabled={isTyping}>
                Execute
              </button>
            </form>
          </div>
        )}

        <button onClick={() => setIsChatOpen(!isChatOpen)} className="bg-[#0d9488] hover:bg-[#0b7a70] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 font-bold text-lg">
          💬
        </button>
      </div>

      {/* Expense Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-xl border border-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-gray-800">Log New Data Entry</h4>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">Item Title Field</label>
                <input type="text" placeholder="e.g. Utility parameters, Logistics" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none" required />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">Value Amount Configuration (₹)</label>
                <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none" required />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">Dataset Segment Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none">
                  <option value="Food">Food & Mess Management</option>
                  <option value="Rent">Rent & Facility Maintenance</option>
                  <option value="Bills">Electricity & Connected Utilities</option>
                  <option value="Entertainment">Outings & Active Subscriptions</option>
                  <option value="Others">Miscellaneous Variables</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#0d9488] text-white py-2 rounded-xl text-xs font-bold shadow-xs">Commit Entry Node</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;