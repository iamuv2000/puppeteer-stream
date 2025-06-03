"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launch = launch;
exports.createWebSocketServer = createWebSocketServer;
exports.getStream = getStream;
const puppeteer_core_1 = require("puppeteer-core");
const path = __importStar(require("path"));
const stream_1 = require("stream");
const ws_1 = __importStar(require("ws"));
const extensionId = "jjndjgheafjngoipoacpjgeicjeomjli";
let currentIndex = 0;
let port;
let ws;
// export const wss = (async () => {
// 	for (let i = 55200; i <= 65535; i++) {
// 		const ws = new WebSocketServer({ port: i });
// 		const promise = await Promise.race([
// 			new Promise((resolve) => {
// 				ws.on("error", (e: any) => {
// 					resolve(!e.message.includes("EADDRINUSE"));
// 				});
// 			}),
// 			new Promise((resolve) => {
// 				ws.on("listening", () => {
// 					resolve(true);
// 				});
// 			}),
// 		]);
// 		if (promise) {
// 			port = i;
// 			return ws;
// 		}
// 	}
// })();
async function launch(arg1, opts) {
    var _a, _b;
    //if puppeteer library is not passed as first argument, then first argument is options
    // @ts-ignore
    if (typeof arg1.launch != "function")
        opts = arg1;
    if (!opts)
        opts = {};
    if (!opts.args)
        opts.args = [];
    function addToArgs(arg, value) {
        if (!value) {
            if (opts.args.includes(arg))
                return;
            return opts.args.push(arg);
        }
        let found = false;
        opts.args = opts.args.map((x) => {
            if (x.includes(arg)) {
                found = true;
                return x + "," + value;
            }
            return x;
        });
        if (!found)
            opts.args.push(arg + value);
    }
    if (!opts.extensionPath) {
        opts.extensionPath = path.join(__dirname, "..", "extension");
    }
    addToArgs("--load-extension=", opts.extensionPath);
    addToArgs("--disable-extensions-except=", opts.extensionPath);
    addToArgs("--allowlisted-extension-id=", extensionId);
    addToArgs("--autoplay-policy=no-user-gesture-required");
    if (((_a = opts.defaultViewport) === null || _a === void 0 ? void 0 : _a.width) && ((_b = opts.defaultViewport) === null || _b === void 0 ? void 0 : _b.height)) {
        opts.args.push(`--window-size=${opts.defaultViewport.width},${opts.defaultViewport.height}`);
        opts.args.push(`--ozone-override-screen-size=${opts.defaultViewport.width},${opts.defaultViewport.height}`);
    }
    // @ts-ignore
    opts.headless = opts.headless === "new" ? "new" : false;
    if (opts.headless) {
        if (!opts.ignoreDefaultArgs)
            opts.ignoreDefaultArgs = [];
        if (Array.isArray(opts.ignoreDefaultArgs) && !opts.ignoreDefaultArgs.includes("--mute-audio"))
            opts.ignoreDefaultArgs.push("--mute-audio");
        if (!opts.args.includes("--headless=new"))
            opts.args.push("--headless=new");
    }
    let browser;
    // @ts-ignore
    if (typeof arg1.launch == "function") {
        // @ts-ignore
        browser = await arg1.launch(opts);
    }
    else {
        browser = await (0, puppeteer_core_1.launch)(opts);
    }
    if (opts.allowIncognito) {
        const settings = await browser.newPage();
        await settings.goto(`chrome://extensions/?id=${extensionId}`);
        await settings.evaluate(() => {
            document
                .querySelector("extensions-manager")
                .shadowRoot.querySelector("#viewManager > extensions-detail-view.active")
                .shadowRoot.querySelector("div#container.page-container > div.page-content > div#options-section extensions-toggle-row#allow-incognito")
                .shadowRoot.querySelector("label#label input")
                .click();
        });
        await settings.close();
    }
    (await browser.newPage()).goto(`chrome-extension://${extensionId}/options.html#${port}`);
    const old_browser_close = browser.close;
    browser.close = async () => {
        for (const page of await browser.pages()) {
            if (!page.url().startsWith(`chrome-extension://${extensionId}/options.html`)) {
                await page.close();
            }
        }
        const extension = await getExtensionPage(browser);
        await extension.evaluate(async () => {
            // @ts-expect-error
            return chrome.tabs.query({});
        });
        if (opts.closeDelay) {
            await new Promise((r) => setTimeout(r, opts.closeDelay));
        }
        await old_browser_close.call(browser);
    };
    return browser;
}
// @ts-ignore
async function createWebSocketServer(startPort = 55200, endPort = 65535, maxAttempts = 100) {
    const triedPorts = new Set();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const port = Math.floor(Math.random() * (endPort - startPort + 1)) + startPort;
        if (triedPorts.has(port))
            continue;
        triedPorts.add(port);
        let ws;
        try {
            // @ts-ignore
            ws = new ws_1.WebSocketServer({ port });
            const result = await Promise.race([
                new Promise((resolve) => {
                    ws.on("error", (e) => {
                        if (!e.message.includes("EADDRINUSE")) {
                            console.error(`[Race Condition Fix] ~ WebSocket error on port ${port}: ${e.message}`);
                        }
                        resolve(false);
                    });
                }),
                new Promise((resolve) => {
                    ws.on("listening", () => resolve(true));
                }),
            ]);
            if (result) {
                console.log(`[Race Condition Fix] ~  Port ${port} is available`);
                return { ws, port };
            }
            else {
                ws.close();
                console.log(`[Race Condition Fix] ~  Port ${port} is not available, trying another`);
            }
        }
        catch (error) {
            if (ws)
                ws.close();
            console.error(`[Race Condition Fix] ~ Unexpected error on port ${port}: ${error.message}`);
        }
    }
    throw new Error("No available port found after multiple attempts.");
}
async function getExtensionPage(browser) {
    const extensionTarget = await browser.waitForTarget((target) => {
        return target.type() === "page" && target.url().startsWith(`chrome-extension://${extensionId}/options.html`);
    });
    if (!extensionTarget)
        throw new Error("cannot load extension");
    const videoCaptureExtension = await extensionTarget.page();
    if (!videoCaptureExtension)
        throw new Error("cannot get page of extension");
    return videoCaptureExtension;
}
let mutex = false;
let queue = [];
function lock() {
    return new Promise((res) => {
        if (!mutex) {
            mutex = true;
            return res(null);
        }
        queue.push(res);
    });
}
function unlock() {
    if (queue.length)
        queue.shift()();
    else
        mutex = false;
}
async function getStream(page, opts) {
    var _a;
    if (!opts.audio && !opts.video)
        throw new Error("At least audio or video must be true");
    if (!opts.mimeType) {
        if (opts.video)
            opts.mimeType = "video/webm";
        else if (opts.audio)
            opts.mimeType = "audio/webm";
    }
    if (!opts.frameSize)
        opts.frameSize = 20;
    const retryPolicy = Object.assign({}, { each: 20, times: 3 }, opts.retry);
    const extension = await getExtensionPage(page.browser());
    const highWaterMarkMB = ((_a = opts.streamConfig) === null || _a === void 0 ? void 0 : _a.highWaterMarkMB) || 8;
    const index = currentIndex++;
    await lock();
    await page.bringToFront();
    const [tab] = await extension.evaluate(async (x) => {
        // @ts-ignore
        return chrome.tabs.query(x);
    }, {
        active: true,
    });
    unlock();
    if (!tab)
        throw new Error("Cannot find tab");
    const stream = new stream_1.Transform({
        highWaterMark: 1024 * 1024 * highWaterMarkMB,
        transform(chunk, encoding, callback) {
            callback(null, chunk);
        },
    });
    function onConnection(ws, req) {
        const url = new URL(`http://localhost:${port}${req.url}`);
        if (url.searchParams.get("index") != index.toString())
            return;
        async function close() {
            var _a, _b;
            if (!stream.readableEnded && !stream.writableEnded)
                stream.end();
            if (!extension.isClosed() && extension.browser().isConnected()) {
                // @ts-ignore
                extension.evaluate((index) => STOP_RECORDING(index), index);
            }
            if (ws.readyState != ws_1.default.CLOSED) {
                setTimeout(() => {
                    // await pending messages to be sent and then close the socket
                    if (ws.readyState != ws_1.default.CLOSED)
                        ws.close();
                }, (_b = (_a = opts.streamConfig) === null || _a === void 0 ? void 0 : _a.closeTimeout) !== null && _b !== void 0 ? _b : 5000);
            }
            ws.off("connection", onConnection);
        }
        ws.on("message", (data) => {
            stream.write(data);
        });
        ws.on("close", close);
        page.on("close", close);
        stream.on("close", close);
    }
    ws.on("connection", onConnection);
    await page.bringToFront();
    await assertExtensionLoaded(extension, retryPolicy);
    await extension.evaluate(
    // @ts-ignore
    (settings) => START_RECORDING(settings), Object.assign(Object.assign({}, opts), { index, tabId: tab.id }));
    return stream;
}
async function assertExtensionLoaded(ext, opt) {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    for (let currentTick = 0; currentTick < opt.times; currentTick++) {
        // @ts-ignore
        if (await ext.evaluate(() => typeof START_RECORDING === "function"))
            return;
        await wait(Math.pow(opt.each, currentTick));
    }
    throw new Error("Could not find START_RECORDING function in the browser context");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHVwcGV0ZWVyU3RyZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUHVwcGV0ZWVyU3RyZWFtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpREEsd0JBb0dDO0FBR0Qsc0RBMkNDO0FBaUZELDhCQThFQztBQWxXRCxtREFPd0I7QUFDeEIsMkNBQTZCO0FBQzdCLG1DQUFtQztBQUNuQyx5Q0FBZ0Q7QUFHaEQsTUFBTSxXQUFXLEdBQUcsa0NBQWtDLENBQUM7QUFDdkQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0FBVXJCLElBQUksSUFBWSxDQUFDO0FBQ2pCLElBQUksRUFBTyxDQUFDO0FBRVosb0NBQW9DO0FBQ3BDLDBDQUEwQztBQUMxQyxpREFBaUQ7QUFDakQseUNBQXlDO0FBQ3pDLGdDQUFnQztBQUNoQyxtQ0FBbUM7QUFDbkMsbURBQW1EO0FBQ25ELFVBQVU7QUFDVixTQUFTO0FBQ1QsZ0NBQWdDO0FBQ2hDLGlDQUFpQztBQUNqQyxzQkFBc0I7QUFDdEIsVUFBVTtBQUNWLFNBQVM7QUFDVCxRQUFRO0FBQ1IsbUJBQW1CO0FBQ25CLGVBQWU7QUFDZixnQkFBZ0I7QUFDaEIsTUFBTTtBQUNOLEtBQUs7QUFDTCxRQUFRO0FBRUQsS0FBSyxVQUFVLE1BQU0sQ0FDM0IsSUFBb0UsRUFDcEUsSUFBMEI7O0lBRTFCLHNGQUFzRjtJQUN0RixhQUFhO0lBQ2IsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksVUFBVTtRQUFFLElBQUksR0FBRyxJQUFJLENBQUM7SUFFbEQsSUFBSSxDQUFDLElBQUk7UUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtRQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRS9CLFNBQVMsU0FBUyxDQUFDLEdBQVcsRUFBRSxLQUFjO1FBQzdDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLElB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