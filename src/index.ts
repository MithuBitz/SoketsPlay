import express from "express";
import axios from "axios";
import http from "http";
import Redis from "ioredis";
import { Server } from "socket.io";

//Express Server
const app = express();

//State to hold the checkbox value
// const state = new Array(50).fill(false);

// Create a redis instance for get and set
const redis = new Redis({ host: "localhost", port: Number(6379) });

// Publisher redis server for implement scaling in Socket
const publisher = new Redis({ host: "localhost", port: Number(6379) });

// Subscriber redis server for implement scaling in Socket
const subscriber = new Redis({ host: "localhost", port: Number(6379) });

//Http Server
const httpServer = http.createServer(app);

//Socket Server
const io = new Server();
io.attach(httpServer);

redis.setnx("state", JSON.stringify(new Array(100).fill(false)));

subscriber.subscribe("server:broker");
subscriber.on("message", (channel, message) => {
  const { event, data } = JSON.parse(message);
  // state[data.index] = data.value;
  // Relay the message to all connected server
  io.emit("checkbox-update", data);
});

//Sockets handler
// .on handler
io.on("connection", (socket) => {
  console.log("Socket connected ", socket.id);
  // setInterval(() => {
  //   socket.emit("Hello from the sokcet server");
  //   socket.emit("How are YOU?");
  // }, 2000);
  socket.on("message", (msg) => {
    console.log(msg);
    //Send or broadcast the msg to all connected clients
    io.emit("server-msg", msg);
  });

  socket.on("checkbox-update", async (data) => {
    const state = await redis.get("state");

    if (state) {
      const parsedState = JSON.parse(state);
      parsedState[data.index] = data.value;
      await redis.set("state", JSON.stringify(parsedState));
    }

    await publisher.publish(
      "server:broker",
      JSON.stringify({ event: "checkbox-update", data })
    );
  });
});

const PORT = process.env.PORT ?? 8080;

app.use(express.static("./public"));

app.get("/state", async (req, res) => {
  const state = await redis.get("state");
  if (state) {
    const parsedState = JSON.parse(state);
    return res.json({ state: parsedState });
  }
  return res.json({ state: [] });
});

app.get("/", (req, res) => {
  return res.json({ status: "success" });
});

app.get("/books", async (req, res) => {
  const response = await axios.get(
    "https://api.freeapi.app/api/v1/public/books"
  );
  return res.json(response.data);
});

app.get("/books/total", async (req, res) => {
  // Lets use Redis to solve the problem
  const cachedValue = await redis.get("totalPageValue");
  if (cachedValue) {
    console.log("Cached HIT");
    return res.json({ totalPageCount: Number(cachedValue) });
  }

  const response = await axios.get(
    "https://api.freeapi.app/api/v1/public/books"
  );

  const totalPageCount = response?.data?.data?.data?.reduce(
    (acc: number, curr: { volumeInfo?: { pageCount?: number } }) =>
      !curr.volumeInfo?.pageCount ? 0 : curr.volumeInfo?.pageCount + acc,
    0
  );

  // Set the cached value with help of redis
  await redis.set("totalPageValue", totalPageCount);

  console.log("Cached MISS");
  return res.json({ totalPageCount });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
