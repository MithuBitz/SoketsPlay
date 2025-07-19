import express from "express";
import axios from "axios";
import http from "http";
import Redis from "ioredis";

const app = express();

const httpServer = http.createServer(app);

const PORT = process.env.PORT ?? 8080;

// Set up the redis
const redis = new Redis({ host: "localhost", port: Number(6379) });

// Set a middleware which act as a rate limiter with help of redis(valkey)
app.use(async function (req, res, next) {
  const key = "rate-limit";
  // const key = `rate-limit:${_id}`; // Rate limit for each user
  const value = await redis.get(key);

  // If no value found set it to 0
  if (value === null) {
    await redis.set(key, 0);
    // Set the key to expire in 1 minute
    await redis.expire(key, 60); // Clear the value after 1 minute
  }

  // If the value is greater than 10 return 429
  if (Number(value) > 10) {
    return res.status(429).json({ message: "Too many requests" });
  }

  redis.incr(key); // Increment by 1
  next();
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

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
