// @ts-ignore
//
"use strict";
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				var desc = Object.getOwnPropertyDescriptor(m, k);
				if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
					desc = {
						enumerable: true,
						get: function () {
							return m[k];
						},
					};
				}
				Object.defineProperty(o, k2, desc);
		  }
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k;
				o[k2] = m[k];
		  });
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", { enumerable: true, value: v });
		  }
		: function (o, v) {
				o["default"] = v;
		  });
var __importStar =
	(this && this.__importStar) ||
	function (mod) {
		if (mod && mod.__esModule) return mod;
		var result = {};
		if (mod != null)
			for (var k in mod)
				if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
		__setModuleDefault(result, mod);
		return result;
	};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStream = exports.launch = exports.wss = void 0;
const puppeteer_core_1 = require("puppeteer-core");
const path = __importStar(require("path"));
const stream_1 = require("stream");
const ws_1 = __importStar(require("ws"));
const extensionPath = path.join(__dirname, "..", "extension");
const extensionId = "jjndjgheafjngoipoacpjgeicjeomjli";
let currentIndex = 0;
let port;
let ws;

async function launch(arg1, opts) {
	var _a, _b;
	//if puppeteer library is not passed as first argument, then first argument is options
	// @ts-ignore
	if (typeof arg1.launch != "function") opts = arg1;
	if (!opts) opts = {};
	if (!opts.args) opts.args = [];
	function addToArgs(arg, value) {
		if (!value) {
			if (opts.args.includes(arg)) return;
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
		if (!found) opts.args.push(arg + value);
	}
	addToArgs("--load-extension=", extensionPath);
	addToArgs("--disable-extensions-except=", extensionPath);
	addToArgs("--allowlisted-extension-id=", extensionId);
	addToArgs("--autoplay-policy=no-user-gesture-required");
	if (
		((_a = opts.defaultViewport) === null || _a === void 0 ? void 0 : _a.width) &&
		((_b = opts.defaultViewport) === null || _b === void 0 ? void 0 : _b.height)
	) {
		opts.args.push(`--window-size=${opts.defaultViewport.width},${opts.defaultViewport.height}`);
		opts.args.push(`--ozone-override-screen-size=${opts.defaultViewport.width},${opts.defaultViewport.height}`);
	}
	// @ts-ignore
	opts.headless = opts.headless === "new" ? "new" : false;
	if (opts.headless) {
		if (!opts.ignoreDefaultArgs) opts.ignoreDefaultArgs = [];
		if (Array.isArray(opts.ignoreDefaultArgs) && !opts.ignoreDefaultArgs.includes("--mute-audio"))
			opts.ignoreDefaultArgs.push("--mute-audio");
		if (!opts.args.includes("--headless=new")) opts.args.push("--headless=new");
	}
	let browser;
	// @ts-ignore
	if (typeof arg1.launch == "function") {
		// @ts-ignore
		browser = await arg1.launch(opts);
	} else {
		browser = await (0, puppeteer_core_1.launch)(opts);
	}
	if (opts.allowIncognito) {
		const settings = await browser.newPage();
		await settings.goto(`chrome://extensions/?id=${extensionId}`);
		await settings.evaluate(() => {
			document
				.querySelector("extensions-manager")
				.shadowRoot.querySelector("#viewManager > extensions-detail-view.active")
				.shadowRoot.querySelector(
					"div#container.page-container > div.page-content > div#options-section extensions-toggle-row#allow-incognito"
				)
				.shadowRoot.querySelector("label#label input")
				.click();
		});
		await settings.close();
	}
	// @ts-ignore

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
exports.launch = launch;
async function getExtensionPage(browser) {
	const extensionTarget = await browser.waitForTarget((target) => {
		return target.type() === "page" && target.url().startsWith(`chrome-extension://${extensionId}/options.html`);
	});
	if (!extensionTarget) throw new Error("cannot load extension");
	const videoCaptureExtension = await extensionTarget.page();
	if (!videoCaptureExtension) throw new Error("cannot get page of extension");
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
	if (queue.length) queue.shift()();
	else mutex = false;
}
// @ts-ignore
async function createWebSocketServer(startPort = 55200, endPort = 65535) {
	for (let i = startPort; i <= endPort; i++) {
		// @ts-ignore
		ws = new ws_1.WebSocketServer({ port: i });

		try {
			const result = await Promise.race([
				new Promise((resolve) => {
					// @ts-ignore
					ws.on("error", (e) => {
						if (e.message.includes("EADDRINUSE")) {
							resolve(false); // Port in use
						} else {
							console.error(`WebSocket error: ${e.message}`);
							resolve(false); // Handle other errors
						}
					});
				}),
				new Promise((resolve) => {
					// @ts-ignore
					ws.on("listening", () => {
						resolve(true); // Port available
					});
				}),
			]);

			if (result) {
				port = i;
				console.log(`Port ${port} is available`);
				return { ws, port };
			} else {
				ws.close(); // Close the server if the port is not available
				console.log(`Port ${i} is not available, trying next`);
			}
		} catch (error) {
			console.error(`Unexpected error: ${error.message}`);
			if (ws) ws.close(); // Ensure the server is closed in case of unexpected errors
		}
	}

	throw new Error("No available ports found in the range.");
}
exports.createWebSocketServer = createWebSocketServer;
async function getStream(page, opts) {
	var _a;
	if (!opts.audio && !opts.video) throw new Error("At least audio or video must be true");
	if (!opts.mimeType) {
		if (opts.video) opts.mimeType = "video/webm";
		else if (opts.audio) opts.mimeType = "audio/webm";
	}
	if (!opts.frameSize) opts.frameSize = 20;
	const retryPolicy = Object.assign({}, { each: 20, times: 3 }, opts.retry);
	const extension = await getExtensionPage(page.browser());
	const highWaterMarkMB = ((_a = opts.streamConfig) === null || _a === void 0 ? void 0 : _a.highWaterMarkMB) || 8;
	const index = currentIndex++;
	await lock();
	await page.bringToFront();
	const [tab] = await extension.evaluate(
		async (x) => {
			// @ts-ignore
			return chrome.tabs.query(x);
		},
		{
			active: true,
		}
	);
	unlock();
	if (!tab) throw new Error("Cannot find tab");
	const stream = new stream_1.Transform({
		highWaterMark: 1024 * 1024 * highWaterMarkMB,
		transform(chunk, encoding, callback) {
			callback(null, chunk);
		},
	});
	function onConnection(ws, req) {
		const url = new URL(`http://localhost:${port}${req.url}`);
		if (url.searchParams.get("index") != index.toString()) return;
		async function close() {
			var _a, _b;
			if (!stream.readableEnded && !stream.writableEnded) stream.end();
			if (!extension.isClosed() && extension.browser().isConnected()) {
				// @ts-ignore
				extension.evaluate((index) => STOP_RECORDING(index), index);
			}
			if (ws.readyState != ws_1.default.CLOSED) {
				setTimeout(
					() => {
						// await pending messages to be sent and then close the socket
						if (ws.readyState != ws_1.default.CLOSED) ws.close();
					},
					(_b = (_a = opts.streamConfig) === null || _a === void 0 ? void 0 : _a.closeTimeout) !== null &&
						_b !== void 0
						? _b
						: 5000
				);
			}
			ws.off("connection", onConnection);
		}
		ws.on("message", (data) => {
			// @ts-ignore
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
		(settings) => START_RECORDING(settings),
		Object.assign(Object.assign({}, opts), { index, tabId: tab.id })
	);
	return stream;
}
exports.getStream = getStream;
async function assertExtensionLoaded(ext, opt) {
	const wait = (ms) => new Promise((res) => setTimeout(res, ms));
	for (let currentTick = 0; currentTick < opt.times; currentTick++) {
		// @ts-ignore
		if (await ext.evaluate(() => typeof START_RECORDING === "function")) return;
		await wait(Math.pow(opt.each, currentTick));
	}
	throw new Error("Could not find START_RECORDING function in the browser context");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHVwcGV0ZWVyU3RyZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1B1cHBldGVlclN0cmVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG1EQU93QjtBQUN4QiwyQ0FBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLHlDQUFnRDtBQUdoRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDOUQsTUFBTSxXQUFXLEdBQUcsa0NBQWtDLENBQUM7QUFDdkQsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0FBUXJCLElBQUksSUFBWSxDQUFDO0FBRUosUUFBQSxHQUFHLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRTtJQUM5QixLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ3BDLE1BQU0sRUFBRSxHQUFHLElBQUksb0JBQWUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztZQUNsQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO2dCQUN2QixFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQU0sRUFBRSxFQUFFO29CQUN6QixPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUM1QyxDQUFDLENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQztZQUNGLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ3ZCLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtvQkFDdkIsT0FBTyxDQUFDLElB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
