"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const http_1 = __importDefault(require("http"));
const ioredis_1 = __importDefault(require("ioredis"));
const socket_io_1 = require("socket.io");
//Express Server
const app = (0, express_1.default)();
//Http Server
const httpServer = http_1.default.createServer(app);
//Socket Server
const io = new socket_io_1.Server();
io.attach(httpServer);
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
});
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 8080;
// Set up the redis
const redis = new ioredis_1.default({ host: "localhost", port: Number(6379) });
app.use(express_1.default.static("./public"));
// Set a middleware which act as a rate limiter with help of redis(valkey)
app.use(function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = "rate-limit";
        // const key = `rate-limit:${_id}`; // Rate limit for each user
        const value = yield redis.get(key);
        // If no value found set it to 0
        if (value === null) {
            yield redis.set(key, 0);
            // Set the key to expire in 1 minute
            yield redis.expire(key, 60); // Clear the value after 1 minute
        }
        // If the value is greater than 10 return 429
        if (Number(value) > 10) {
            return res.status(429).json({ message: "Too many requests" });
        }
        redis.incr(key); // Increment by 1
        next();
    });
});
app.get("/", (req, res) => {
    return res.json({ status: "success" });
});
app.get("/books", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield axios_1.default.get("https://api.freeapi.app/api/v1/public/books");
    return res.json(response.data);
}));
app.get("/books/total", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // Lets use Redis to solve the problem
    const cachedValue = yield redis.get("totalPageValue");
    if (cachedValue) {
        console.log("Cached HIT");
        return res.json({ totalPageCount: Number(cachedValue) });
    }
    const response = yield axios_1.default.get("https://api.freeapi.app/api/v1/public/books");
    const totalPageCount = (_c = (_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.reduce((acc, curr) => { var _a, _b; return !((_a = curr.volumeInfo) === null || _a === void 0 ? void 0 : _a.pageCount) ? 0 : ((_b = curr.volumeInfo) === null || _b === void 0 ? void 0 : _b.pageCount) + acc; }, 0);
    // Set the cached value with help of redis
    yield redis.set("totalPageValue", totalPageCount);
    console.log("Cached MISS");
    return res.json({ totalPageCount });
}));
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
