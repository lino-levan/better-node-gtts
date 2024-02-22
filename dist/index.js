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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Text2Speech = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const multistream_1 = __importDefault(require("multistream"));
const http_1 = __importDefault(require("http"));
const escapeStringRegexp_1 = require("./vendored/escapeStringRegexp");
const languages_1 = require("./languages");
const GOOGLE_TTS_URL = "http://translate.google.com/translate_tts";
const DEFAULT_MAX_CHARS = 100;
class Text2Speech {
    constructor(_lang, _debug) {
        this.lang = _lang !== null && _lang !== void 0 ? _lang : "en";
        this.debug = _debug !== null && _debug !== void 0 ? _debug : false;
        this.lang = this.lang.toLowerCase();
        this.maxChars = DEFAULT_MAX_CHARS;
        this.getArgs = this.getArgsFactory(this.lang);
        if (languages_1.LANGUAGES[this.lang] === undefined) {
            throw new Error("Language not supported: " + this.lang);
        }
    }
    save(filepath, text) {
        return __awaiter(this, void 0, void 0, function* () {
            const textParts = this.tokenize(text);
            const total = textParts.length;
            for (const part of textParts) {
                const index = textParts.indexOf(part);
                const headers = this.getHeader();
                const args = this.getArgs(part, index, total);
                const fullUrl = GOOGLE_TTS_URL + args;
                yield new Promise((resolve, reject) => {
                    const writeStream = fs_1.default.createWriteStream(filepath, {
                        flags: index > 0 ? "a" : "w",
                    });
                    (0, axios_1.default)({
                        url: fullUrl,
                        headers,
                        method: "GET",
                        responseType: "stream",
                    }).then((response) => {
                        response.data.pipe(writeStream);
                    });
                    writeStream.on("finish", resolve);
                    writeStream.on("error", reject);
                });
            }
        });
    }
    stream(text) {
        return __awaiter(this, void 0, void 0, function* () {
            const textParts = this.tokenize(text);
            const total = textParts.length;
            const streams = yield Promise.all(textParts.map((part, index) => {
                return new Promise((resolve) => {
                    const headers = this.getHeader();
                    const args = this.getArgs(part, index, total);
                    const fullUrl = GOOGLE_TTS_URL + args;
                    (0, axios_1.default)({
                        url: fullUrl,
                        headers,
                        method: "GET",
                        responseType: "stream",
                    }).then((response) => {
                        resolve(response.data);
                    });
                });
            }));
            return new multistream_1.default(streams);
        });
    }
    getHeader() {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/536.26.17 (KHTML like Gecko) Version/6.0.2 Safari/536.26.17",
        };
        if (this.debug)
            console.log(headers);
        return headers;
    }
    getArgsFactory(lang) {
        return (text, index, total) => {
            const textlen = text.length;
            const encodedText = encodeURIComponent(text);
            const language = lang !== null && lang !== void 0 ? lang : "en";
            return `?ie=UTF-8&tl=${language}&q=${encodedText}&total=${total}&idx=${index}&client=tw-ob&textlen=${textlen}`;
        };
    }
    tokenize(text) {
        if (text === "")
            throw new Error("No text to speak");
        const punc = "¡!()[]¿?.,;:—«»\n";
        const puncList = punc.split("").map(function (char) {
            return (0, escapeStringRegexp_1.escapeStringRegexp)(char);
        });
        const pattern = puncList.join("|");
        let parts = text.split(new RegExp(pattern));
        parts = parts.filter((p) => p.length > 0);
        parts = parts.flatMap((str) => {
            if (str.length <= 100) {
              return str;
            } else {
              const slicedStrings = [];
              let i = 0;
              while (i < str.length) {
                const slicedString = str.substring(i, i + 100);
                slicedStrings.push(slicedString);
                i += 100;
              }
              return slicedStrings;
            }
          });
          
        const output = [];

        for (let part of parts) {
          if (part.length <= DEFAULT_MAX_CHARS) {
            output.push(part);
          } else {
            let startIndex = 0;
            let endIndex = DEFAULT_MAX_CHARS;
            while (startIndex < part.length) {
              if (endIndex >= part.length) {
                endIndex = part.length;
              } else {
                while (part[endIndex] !== ' ' && endIndex > startIndex) {
                  endIndex--;
                }
              }
              output.push(part.slice(startIndex, endIndex));
              startIndex = endIndex + 1;
              endIndex = startIndex + DEFAULT_MAX_CHARS;
            }
          }
        }
        
        return output;
    }
    createServer(port) {
        const server = http_1.default.createServer((req, res) => __awaiter(this, void 0, void 0, function* () {
            if (req.url === undefined)
                throw new Error("???");
            const queryData = new URL(req.url).searchParams;
            const text = queryData.get("text");
            if (typeof text === "string") {
                res.writeHead(200, { "Content-Type": "audio/mpeg" });
                (yield this.stream(text)).pipe(res);
            }
            else {
                console.log(req.headers);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    code: -1,
                    message: `Missing text. Please try: ${req.headers.host}?text=your+text`,
                }));
            }
        }));
        server.listen(port);
        console.log("Text-to-Speech Server running on " + port);
    }
}
exports.Text2Speech = Text2Speech;
exports.default = new Text2Speech();
//# sourceMappingURL=index.js.map