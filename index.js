const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

const serviceAccount = require("./firebaseConfig.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const options = {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
};
app.use(cors());
app.use(express.json());

app.get("/users", async (req, res) => {
  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.params.id);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    res.status(200).json(doc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create_user", async (req, res) => {
  try {
    const { username, password, role,age ,patientId} = req.body;
    if (!username || !password || !role || !age || !patientId)
      return res.status(400).json({ error: "Missing Valus" });

    const usersRef = db.collection("users");
    const existingUser = await usersRef.where("patientId", "==", patientId).get();

    if (!existingUser.empty)
      return res.status(400).json({ error: "patientId already exists" });
    let newMessage = {
      role:"admin",
      text:"Hi! You Can chat with Doctor",
      time: new Intl.DateTimeFormat("en-IN", options).format(new Date()),
    };
    const newUser = await usersRef.add({
      patientId,
      username,
      password,
      role,
      age,
      predictions: {},
      messages: [newMessage],
    });
    res
      .status(201)
      .json({ message: "User created successfully", user_id: newUser.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { patientId, password } = req.body;
    if (!patientId || !password)
      return res.status(400).json({ error: "Missing username or password" });

    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("patientId", "==", patientId).get();

    if (snapshot.empty)
      return res.status(401).json({ error: "Invalid credentials" });

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.password !== password)
      return res.status(401).json({ error: "Invalid credentials" });

    res.status(200).json({
      message: "Login successful",
      user: userData,
      user_id: userDoc.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on("connection", (socket) => {
  console.log("New user connected");

  // User joins room
  socket.on("joinRoom", async (UserId) => {
    socket.join(UserId);
    console.log(`User joined room: ${UserId}`);

    try {
      const userRef = db.collection("users").doc(UserId);
      const doc = await userRef.get();

      if (doc.exists) {
        const messages = doc.data().messages || [];
        socket.emit("Joined", messages); // Send existing messages to the user
      } else {
        socket.emit("Joined", []); // Send empty if no messages exist
      }
    } catch (error) {
      console.error("Error fetching user messages:", error);
    }
  });

  // Send and store message
  socket.on("sendMessage", async ({ UserId, role, text, review = null,report=null }) => {
    try {
      const userRef = db.collection("users").doc(UserId);
      let newMessage = {};
      if (review) {
        newMessage = {
          role: "system",
          review,
          report,
          time: new Intl.DateTimeFormat("en-IN", options).format(new Date()),
        };

      } else {
        newMessage = {
          role,
          text,
          time: new Intl.DateTimeFormat("en-IN", options).format(new Date()),
        };
      }
      io.to(UserId).emit("receiveMessage", newMessage);
      await userRef.update({
        messages: admin.firestore.FieldValue.arrayUnion(newMessage),
        predictions:review?newMessage:{}
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
