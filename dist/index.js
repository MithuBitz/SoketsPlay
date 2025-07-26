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
//State to hold the checkbox value
// const state = new Array(50).fill(false);
// Create a redis instance for get and set
const redis = new ioredis_1.default({ host: "localhost", port: Number(6379) });
// Publisher redis server for implement scaling in Socket
const publisher = new ioredis_1.default({ host: "localhost", port: Number(6379) });
// Subscriber redis server for implement scaling in Socket
const subscriber = new ioredis_1.default({ host: "localhost", port: Number(6379) });
//Http Server
const httpServer = http_1.default.createServer(app);
//Socket Server
const io = new socket_io_1.Server();
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
    socket.on("checkbox-update", (data) => __awaiter(void 0, void 0, void 0, function* () {
        const state = yield redis.get("state");
        if (state) {
            const parsedState = JSON.parse(state);
            parsedState[data.index] = data.value;
            yield redis.set("state", JSON.stringify(parsedState));
        }
        yield publisher.publish("server:broker", JSON.stringify({ event: "checkbox-update", data }));
    }));
});
const PORT = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : 8080;
app.use(express_1.default.static("./public"));
app.get("/state", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const state = yield redis.get("state");
    if (state) {
        const parsedState = JSON.parse(state);
        return res.json({ state: parsedState });
    }
    return res.json({ state: [] });
}));
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
