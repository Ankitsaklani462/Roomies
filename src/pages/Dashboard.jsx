import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion, collection, addDoc, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// PDF Libraries Import
import { jsPDF } from "jspdf";
import "jspdf-autotable";

function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState("May 2026");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [roomMembersCount, setRoomMembersCount] = useState(1);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  const [roomName, setRoomName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [myRoomCode, setMyRoomCode] = useState("");
  const [myRoomName, setMyRoomName] = useState("");

  const [profile, setProfile] = useState({
    name: auth.currentUser?.displayName || "Ankit Saklani",
    email: auth.currentUser?.email || "ankit@example.com",
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

  // Firebase Realtime Observers
  useEffect(() => {
    if (!auth.currentUser) return;

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.roomCode) {
          setMyRoomCode(userData.roomCode);
          setMyRoomName(userData.roomName || "My Group");
        }
        setProfile(prev => ({
          ...prev,
          name: userData.name || prev.name,
          avatar: userData.avatar || prev.avatar,
          role: userData.role || "Roommate"
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (!myRoomCode) return;

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
  }, [myRoomCode]);

  useEffect(() => {
    if (!myRoomCode) {
      setExpenses([]);
      return;
    }

    const q = query(collection(db, "expenses"), where("roomCode", "==", myRoomCode));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const expensesData = [];
      querySnapshot.forEach((doc) => {
        expensesData.push({ id: doc.id, ...doc.data() });
      });
      expensesData.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(expensesData);
    });

    return () => unsubscribe();
  }, [myRoomCode]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount || parseFloat(amount) <= 0 || !category) {
      alert("Please fill all fields correctly!");
      return;
    }
    if (!myRoomCode) {
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
        roomCode: myRoomCode,
        addedBy: profile.name,
        addedById: auth.currentUser.uid,
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
    if (addedById !== auth.currentUser?.uid) {
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
        createdBy: auth.currentUser.uid,
        createdAt: Date.now(),
        members: arrayUnion(auth.currentUser.uid)
      });
      await setDoc(doc(db, "users", auth.currentUser.uid), {
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
        await updateDoc(roomDocRef, { members: arrayUnion(auth.currentUser.uid) });
        await setDoc(doc(db, "users", auth.currentUser.uid), {
          roomCode: upperCode,
          roomName: roomData.roomName,
          role: "Roommate"
        }, { merge: true });

        setMyRoomCode(upperCode);
        setMyRoomName(roomData.roomName);
        setProfile(prev => ({ ...prev, role: "Roommate" }));
        setInviteCodeInput("");
        setProfileMessage(`Joined ${roomData.roomName}!`);
      } else {
        setProfileError("Invalid Code. Room not found.");
      }
    } catch (err) {
      setProfileError("Error joining room.");
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        setProfile({ ...profile, avatar: reader.result });
        await setDoc(doc(db, "users", auth.currentUser.uid), { avatar: reader.result }, { merge: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) return;
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: profile.name.trim() });
        await setDoc(doc(db, "users", auth.currentUser.uid), { name: profile.name.trim() }, { merge: true });
      }
      setProfileMessage("Profile updated successfully!");
    } catch (err) {
      setProfileError("Failed to update profile.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setProfileError("Passwords do not match!");
      return;
    }
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setProfileMessage("Password changed successfully!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setProfileError("Failed to change password. Re-login and try again.");
    }
  };

  // Calculations
  const roomTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const perHeadShare = roomMembersCount > 0 ? roomTotal / roomMembersCount : 0;
  const myPaidTotal = expenses.filter(exp => exp.addedById === auth.currentUser?.uid).reduce((sum, exp) => sum + Number(exp.amount), 0);

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

  // PDF Export Function
  const exportToPDF = () => {
    if (expenses.length === 0) {
      alert("No data available to export!");
      return;
    }
    try {
      const pdfDoc = new jsPDF();
      pdfDoc.text(`${myRoomName || "Roomies"} Expense Report - ${selectedMonth}`, 14, 15);
      pdfDoc.text(`Total Amount: INR ${roomTotal.toFixed(2)}`, 14, 23);
      pdfDoc.text(`Per Head Share: INR ${perHeadShare.toFixed(2)} (Total Members: ${roomMembersCount})`, 14, 29);
      
      const tableRows = expenses.map(exp => [
        exp.title, 
        exp.category, 
        `INR ${Number(exp.amount).toFixed(2)}`, 
        exp.addedBy || "Member", 
        exp.date || "N/A"
      ]);

      pdfDoc.autoTable({
        head: [["Description", "Category", "Amount", "Added By", "Date"]],
        body: tableRows,
        startY: 36,
      });

      pdfDoc.save(`Expense_Report_${selectedMonth.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF. Make sure 'jspdf' and 'jspdf-autotable' are installed.");
    }
  };

  // CSV Export Function
  const exportToCSV = () => {
    if (expenses.length === 0) {
      alert("No data available to export!");
      return;
    }
    try {
      const headers = ["Description", "Category", "Amount (INR)", "Added By", "Date"];
      const rows = expenses.map(exp => [
        `"${exp.title.replace(/"/g, '""')}"`,
        `"${exp.category}"`,
        exp.amount,
        `"${exp.addedBy || "Member"}"`,
        `"${exp.date || "N/A"}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Expense_Report_${selectedMonth.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert("Failed to export CSV.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-700 select-none">
      
      {/* Sidebar */}
      <div className="w-[260px] bg-white border-r border-gray-100 flex flex-col justify-between p-6 shrink-0 h-screen sticky top-0">
        <div>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#0d9488] tracking-tight">Roomies</h1>
            <p className="text-xs text-gray-400 mt-0.5">{myRoomName ? `${myRoomName} ▾` : "No Room Connected ▾"}</p>
            {myRoomCode && (
              <div className="space-y-1 mt-1">
                <p className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded inline-block font-mono font-bold">Code: {myRoomCode}</p>
                <p className="text-[10px] text-teal-600 block font-semibold">👥 {roomMembersCount} Members Active</p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-xl mb-6">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#0d9488]/20 flex items-center justify-center font-bold text-[#0d9488]">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 leading-tight truncate w-[140px]">{profile.name}</h4>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${profile.role === "Admin" ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-500"}`}>
                @{profile.role.toLowerCase()}
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setActiveTab("dashboard")} className={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === "dashboard" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Dashboard</span></button>
            <button onClick={() => setActiveTab("expenses")} className={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === "expenses" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Room Expenses</span></button>
            <button onClick={() => setActiveTab("settlements")} className={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === "settlements" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Settlements</span></button>
            <button onClick={() => setActiveTab("profile")} className={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === "profile" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>My Profile</span></button>
            <button onClick={() => setActiveTab("settings")} className={`w-full text-left flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === "settings" ? "bg-[#e6f4f2] text-[#0d9488] font-semibold" : "text-gray-500 hover:bg-gray-50"}`}><span>Settings</span></button>
          </nav>
        </div>

        <div className="space-y-1 pt-4 border-t border-gray-100">
          <button onClick={() => { if(window.confirm("Do you want to logout?")) navigate("/"); }} className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs font-medium transition-colors text-left">
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto h-screen">
        
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800 capitalize">{activeTab === "expenses" ? "Room Expenses" : activeTab === "profile" ? "My Profile" : activeTab}</h2>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsModalOpen(true)} className="bg-[#0d9488] hover:bg-[#0b7a70] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors mr-2">
              + Add Expense
            </button>

            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm focus:outline-none">
              <option value="May 2026">May 2026</option>
            </select>

            <button onClick={exportToPDF} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-gray-50 shadow-sm">
              Export PDF
            </button>

            <button onClick={exportToCSV} className="bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-[#0d9488]/20 shadow-sm">
              Export CSV
            </button>
          </div>
        </div>
        
        {activeTab === "dashboard" && (
          <div>
            {!myRoomCode && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-semibold mb-6 flex justify-between items-center">
                <span>You have not joined any Room yet. Go to "My Profile" to Create or Join a Room!</span>
                <button onClick={() => setActiveTab("profile")} className="bg-amber-600 text-white px-3 py-1 rounded-lg text-[11px]">Setup Room</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-xs font-semibold text-gray-400">My Paid Amount</span>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">₹{myPaidTotal.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-xs font-semibold text-gray-400">Room Total</span>
                <h3 className="text-2xl font-bold text-[#0d9488] mt-1">₹{roomTotal.toFixed(2)}</h3>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-xs font-semibold text-gray-400">Per Head Share</span>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">₹{perHeadShare.toFixed(2)}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 lg:col-span-12 shadow-sm">
                <h4 className="text-sm font-bold text-gray-800 mb-4">Roommates Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(memberBalances).length === 0 ? (
                    <p className="text-xs text-gray-400">No expenses recorded yet.</p>
                  ) : (
                    Object.keys(memberBalances).map((name) => {
                      const paid = memberBalances[name];
                      const net = paid - perHeadShare;
                      return (
                        <div key={name} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                          <h5 className="text-xs font-bold text-gray-800">{name}</h5>
                          <div className="flex justify-between text-[11px] mt-2 text-gray-500">
                            <span>Total Spent:</span>
                            <span className="font-bold">₹{paid.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] mt-1">
                            <span>Status:</span>
                            <span className={`font-bold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {net >= 0 ? `Gets back ₹${net.toFixed(2)}` : `Owes ₹${Math.abs(net).toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 lg:col-span-12 shadow-sm">
                <h4 className="text-sm font-bold text-gray-800 mb-4">Whole Room Expenses Log</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="pb-3 font-semibold">Description</th>
                        <th className="pb-3 font-semibold">Category</th>
                        <th className="pb-3 font-semibold">Brought By</th>
                        <th className="pb-3 font-semibold">Date</th>
                        <th className="pb-3 font-semibold text-right">Amount</th>
                        <th className="pb-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-4 text-gray-400">No expenses found.</td>
                        </tr>
                      ) : (
                        expenses.map((exp) => (
                          <tr key={exp.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50/50">
                            <td className="py-3 font-medium text-gray-800 capitalize">{exp.title}</td>
                            <td className="py-3 text-gray-500"><span className="bg-gray-100 px-2 py-0.5 rounded-full">{exp.category}</span></td>
                            <td className="py-3 text-gray-700 font-semibold">{exp.addedBy}</td>
                            <td className="py-3 text-gray-400">{exp.date || "N/A"}</td>
                            <td className="py-3 font-bold text-gray-800 text-right">₹{Number(exp.amount).toFixed(2)}</td>
                            <td className="py-3 text-center">
                              {exp.addedById === auth.currentUser?.uid ? (
                                <button onClick={() => handleDeleteExpense(exp.id, exp.addedById)} className="text-red-500 hover:text-red-700 font-bold px-2 py-0.5 rounded hover:bg-red-50">
                                  Delete
                                </button>
                              ) : (
                                <span className="text-gray-300 text-[10px] italic">Locked</span>
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
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-sm font-bold text-gray-800 mb-6">Room Expenses Log ({myRoomName || "None"})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Paid By</th>
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
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
        )}

        {activeTab === "settlements" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 lg:col-span-7 shadow-sm">
              <h4 className="text-sm font-bold text-gray-800 mb-1">Room Share Summary</h4>
              <p className="text-xs text-gray-400 mb-4">Total Expense: ₹{roomTotal.toFixed(2)} | Per Head Share: ₹{perHeadShare.toFixed(2)}</p>
              
              <div className="space-y-3">
                {Object.keys(memberBalances).length === 0 ? (
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-xs font-semibold text-center">No expenses tracked yet.</div>
                ) : (
                  Object.keys(memberBalances).map((name) => {
                    const paid = memberBalances[name];
                    const net = paid - perHeadShare;
                    return (
                      <div key={name} className="flex justify-between items-center p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                        <div>
                          <h5 className="text-xs font-bold text-gray-800">{name}</h5>
                          <p className="text-[11px] text-gray-400">Total Spent: ₹{paid.toFixed(2)}</p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-lg ${net >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {net >= 0 ? `Gets back: ₹${net.toFixed(2)}` : `Owes: ₹${Math.abs(net).toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 lg:col-span-5 shadow-sm">
              <h4 className="text-sm font-bold text-gray-800 mb-1">Who Owes Whom</h4>
              <p className="text-xs text-gray-400 mb-4">Clear balances easily.</p>
              <div className="space-y-3">
                {roomTotal === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No transactions to display.</p>
                ) : getSettlementMatrix().length === 0 ? (
                  <div className="bg-green-50 text-green-800 p-4 rounded-xl text-xs font-semibold text-center">🎉 Everyone is squared away!</div>
                ) : (
                  getSettlementMatrix().map((tx, idx) => (
                    <div key={idx} className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs">
                      <span className="font-bold text-red-600">{tx.from}</span> will pay <span className="font-bold text-green-700">₹{tx.amount.toFixed(2)}</span> to <span className="font-bold text-teal-800">{tx.to}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Create New Room</h4>
                <form onSubmit={handleCreateRoom} className="space-y-3">
                  <input type="text" placeholder="e.g. Room No. 4" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800" required />
                  <button type="submit" className="bg-[#0d9488] text-white px-4 py-2 rounded-xl text-xs font-bold w-full">Create & Get Code</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Join Existing Room</h4>
                <form onSubmit={handleJoinRoom} className="space-y-3">
                  <input type="text" placeholder="Enter Invite Code" value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 uppercase tracking-wider" required />
                  <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold w-full">Join Room</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                {myRoomCode ? (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-gray-800">Scan QR to Join Room</h5>
                    <div className="bg-white p-2 border border-gray-100 rounded-xl shadow-xs">
                      <canvas ref={canvasRef} width="150" height="150" className="mx-auto" />
                    </div>
                    <p className="text-[11px] font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md inline-block">Room ID: {myRoomCode}</p>
                  </div>
                ) : (
                  <div className="text-gray-300 text-center p-4">
                    <div className="text-2xl mb-1">🔳</div>
                    <p className="text-[11px] max-w-[160px]">Create or join a room to generate group QR code.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-7 space-y-6">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Personal Details</h4>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Display Name</label>
                    <input 
                      type="text" 
                      value={profile.name} 
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })} 
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0d9488]" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Email Address</label>
                    <input 
                      type="email" 
                      value={profile.email} 
                      disabled 
                      className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-400 cursor-not-allowed focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Avatar Profile Picture</label>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleAvatarChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Choose New Image File
                    </button>
                  </div>
                  <button type="submit" className="bg-[#0d9488] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                    Save General Settings
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-5 space-y-6">
                <h4 className="text-sm font-bold text-gray-800 mb-1">Security Settings</h4>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">New Password</label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0d9488]" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0d9488]" 
                      required 
                    />
                  </div>
                  <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                    Update Security Password
                  </button>
                </form>
              </div>
            </div>

            {(profileMessage || profileError) && (
              <div className="p-4 rounded-xl text-xs font-medium">
                {profileMessage && <p className="text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-lg">{profileMessage}</p>}
                {profileError && <p className="text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">{profileError}</p>}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm max-w-xl">
            <h4 className="text-sm font-bold text-gray-800 mb-4">Application Preferences</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                <div>
                  <h5 className="text-xs font-bold text-gray-800">Push Notifications</h5>
                  <p className="text-[11px] text-gray-400">Receive real-time settlement tracking updates</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.notifications} 
                  onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })} 
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4" 
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                <div>
                  <h5 className="text-xs font-bold text-gray-800">System Base Currency</h5>
                  <p className="text-[11px] text-gray-400">Localization configuration for displaying balances</p>
                </div>
                <select 
                  value={settings.currency} 
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })} 
                  className="bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-800">Log Room Expense</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Expense Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Wi-Fi Bill or Groceries" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0d9488]" 
                  required 
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Transaction Amount (INR)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0d9488]" 
                  required 
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Classification Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#0d9488]"
                >
                  <option value="Food">Food & Catering</option>
                  <option value="Rent">Monthly Rent</option>
                  <option value="Utilities">Utilities & Bills</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Other">Miscellaneous Expenses</option>
                </select>
              </div>
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold border border-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0b7a70] text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  Confirm Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;