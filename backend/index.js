const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const Stripe = require("stripe");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8080;

// MongoDB connection
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.log(err));

// User Schema
const userSchema = mongoose.Schema({
  firstName: String,
  lastName: String,
  email: {
    type: String,
    unique: true,
  },
  password: String,
  confirmPassword: String,
  image: String,
});

const userModel = mongoose.model("user", userSchema);

// Product Schema
const schemaProduct = mongoose.Schema({
  name: String,
  category: String,
  image: String,
  price: Number, // Changed to Number for calculations
  description: String,
});

const productModel = mongoose.model("product", schemaProduct);

// Bill Schema
const billSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  items: [
    {
      name: String,
      price: Number,
      qty: Number,
    },
  ],
  totalAmount: Number,
  date: { type: Date, default: Date.now },
});

const BillModel = mongoose.model("Bill", billSchema);

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const token =
    req.headers["authorization"] && req.headers["authorization"].split(" ")[1];

  if (!token) return res.sendStatus(401); // Unauthorized if no token is provided

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Forbidden if token is invalid
    req.user = user; // Attach user info to request object
    next(); // Proceed to the next middleware or route handler
  });
};

// API Routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Signup Route
app.post("/signup", async (req, res) => {
  const { email } = req.body;

  const existingUser = await userModel.findOne({ email });

  if (existingUser) {
    return res.send({
      message: "Email id is already registered",
      alert: false,
    });
  }

  const data = new userModel(req.body);

  await data.save();

  res.send({ message: "Successfully signed up", alert: true });
});

// Login Route
app.post("/login", async (req, res) => {
  const { email } = req.body;

  const result = await userModel.findOne({ email });

  if (result) {
    const dataSend = {
      _id: result._id,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      image: result.image,
    };

    // Generate a token
    const token = jwt.sign({ id: result._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    }); // Set expiration as needed

    res.send({
      message: "Login is successful",
      alert: true,
      data: dataSend,
      token, // Send the token back to the client
    });
  } else {
    res.send({
      message: "Email is not available, please sign up",
      alert: false,
    });
  }
});

// Save Product Route
app.post("/uploadProduct", async (req, res) => {
  const data = new productModel(req.body);

  await data.save();

  res.send({ message: "Product uploaded successfully" });
});

// Get All Products Route
app.get("/product", async (req, res) => {
  const data = await productModel.find({});

  res.send(JSON.stringify(data));
});

// Stripe Payment Setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId, items } = req.body; // Destructure userId and items from request body

    console.log("Incoming request body:", req.body); // Log incoming request for debugging

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items must be an array." });
    }

    const params = {
      submit_type: "pay",
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      shipping_options: [{ shipping_rate: "shr_1QMU2CHBTzTAd4Of5wvXF0fX" }],

      line_items: items.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price * 100, // Convert price to paise
        },
        adjustable_quantity: { enabled: true, minimum: 1 },
        quantity: item.qty,
      })),

      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    };

    const session = await stripe.checkout.sessions.create(params);

    // Save the bill after payment is processed successfully
    const billData = {
      userId, // Use destructured userId
      items: items.map((item) => ({
        name: item.name,
        price: item.price * 100,
        qty: item.qty,
      })),
      totalAmount: items.reduce((acc, curr) => acc + curr.price * curr.qty, 0),
    };

    const newBill = new BillModel(billData);
    await newBill.save();

    res.status(200).json(session.id); // Return only the session ID as a string
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// Get Bills for a User - Protected Route
app.get("/bills/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from verified token
    const bills = await BillModel.find({ userId }).populate("userId");

    console.log("Bills retrieved:", bills); // Debugging line
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).send({ message: "Error fetching bills" });
  }
});

// Server Listening
app.listen(PORT, () => console.log("Server is running at port:", PORT));
