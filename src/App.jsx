function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      
      <h1 className="text-4xl font-bold text-center mb-8">
        Room Expense Manager
      </h1>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl mb-2">Total Expense</h2>
          <p className="text-3xl font-bold text-green-400">₹12,500</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl mb-2">This Month</h2>
          <p className="text-3xl font-bold text-blue-400">₹4,200</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl mb-2">Pending</h2>
          <p className="text-3xl font-bold text-red-400">₹1,500</p>
        </div>

      </div>

      {/* Add Expense */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg mb-10">
        
        <h2 className="text-2xl font-bold mb-4">
          Add Expense
        </h2>

        <div className="grid md:grid-cols-3 gap-4">

          <input
            type="text"
            placeholder="Expense Name"
            className="p-3 rounded-xl bg-gray-700 outline-none"
          />

          <input
            type="number"
            placeholder="Amount"
            className="p-3 rounded-xl bg-gray-700 outline-none"
          />

          <select className="p-3 rounded-xl bg-gray-700 outline-none">
            <option>Paid By</option>
            <option>Ankit</option>
            <option>Rahul</option>
            <option>Aman</option>
          </select>

        </div>

        <button className="mt-5 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold">
          Add Expense
        </button>

      </div>

      {/* Expense List */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
        
        <h2 className="text-2xl font-bold mb-4">
          Recent Expenses
        </h2>

        <div className="space-y-4">

          <div className="bg-gray-700 p-4 rounded-xl flex justify-between">
            <div>
              <h3 className="font-bold">Room Rent</h3>
              <p className="text-gray-300">Paid by Ankit</p>
            </div>

            <p className="text-green-400 font-bold text-xl">
              ₹12,000
            </p>
          </div>

          <div className="bg-gray-700 p-4 rounded-xl flex justify-between">
            <div>
              <h3 className="font-bold">Milk</h3>
              <p className="text-gray-300">Paid by Rahul</p>
            </div>

            <p className="text-green-400 font-bold text-xl">
              ₹60
            </p>
          </div>

        </div>

      </div>

    </div>
  )
}

export default App