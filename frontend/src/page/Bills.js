import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Bills = () => {
  const [bills, setBills] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = localStorage.getItem("userId"); // Get user ID from local storage
    fetchBills(userId); // Fetch bills when component mounts
  }, []);

  const fetchBills = async (userId) => {
    const token = localStorage.getItem("token"); // Retrieve token from local storage

    try {
      const response = await fetch(`http://localhost:8080/bills/${userId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`, // Include JWT token in header
        },
      });

      if (!response.ok) {
        const errorData = await response.text(); // Use text() to see the full response
        console.error("Error fetching bills:", errorData); // Log full error response
        return;
      }

      const fetchedBills = await response.json();
      setBills(fetchedBills); // Set fetched bills to state
    } catch (error) {
      console.error("Error fetching bills:", error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-slate-600">Your Bills</h2>
      {bills.length === 0 ? (
        <p>No bills found.</p>
      ) : (
        <div className="mt-4">
          {bills.map((bill) => (
            <div key={bill._id} className="border p-4 mb-4">
              <h3 className="font-bold">Bill ID: {bill._id}</h3>
              <p>Date: {new Date(bill.date).toLocaleString()}</p>
              <p>Total Amount: ₹{bill.totalAmount.toFixed(2)}</p>{" "}
              {/* Convert totalAmount from paise to rupees */}
              <h4 className="font-semibold">Items:</h4>
              <ul>
                {bill.items.map((item) => (
                  <li key={item.name}>
                    {item.name} - Qty: {item.qty} - Price: ₹
                    {item.price.toFixed(2)}{" "}
                    {/* Convert item price from paise to rupees */}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bills;
