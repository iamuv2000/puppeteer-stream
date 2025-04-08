/// <reference types="node" />
import { LaunchOptions, Browser, Page, BrowserLaunchArgumentOptions, BrowserConnectOptions } from "puppeteer-core";
import { Transform } from "stream";
type StreamLaunchOptions = LaunchOptions &
	BrowserLaunchArgumentOptions &
	BrowserConnectOptions & {
		allowIncognito?: boolean;
	} & {
		closeDelay?: number;
	} & {
		extensionPath?: string;
	};
export declare function launch(
	arg1:
		| StreamLaunchOptions
		| {
				launch?: Function;
				[key: string]: any;
		  },
	opts?: StreamLaunchOptions
): Promise<Browser>;
export declare function createWebSocketServer(
	startPort?: number,
	endPort?: number
): Promise<{
	ws: any;
	port: number;
}>;
export type BrowserMimeType =
	| "video/webm"
	| "video/webm;codecs=vp8"
	| "video/webm;codecs=vp9"
	| "video/webm;codecs=vp8.0"
	| "video/webm;codecs=vp9.0"
	| "video/webm;codecs=vp8,opus"
	| "video/webm;codecs=vp8,pcm"
	| "video/WEBM;codecs=VP8,OPUS"
	| "video/webm;codecs=vp9,opus"
	| "video/webm;codecs=vp8,vp9,opus"
	| "audio/webm"
	| "audio/webm;codecs=opus"
	| "audio/webm;codecs=pcm"
	| "video/mp4"
	| "video/mp4;codecs=avc1.42E01E" // Baseline H.264
	| "video/mp4;codecs=avc1.64001F" // High H.264
	| "video/mp4;codecs=avc1.4D401F" // Main H.264
	| "video/mp4;codecs=avc1.42001E,mp4a.40.2" // H.264 + AAC
	| "audio/mp4"
	| "audio/mp4;codecs=mp4a.40.2"; // AAC

export type Constraints = {
	mandatory?: MediaTrackConstraints;
	optional?: MediaTrackConstraints;
};
export interface getStreamOptions {
	audio: boolean;
	video: boolean;
	videoConstraints?: Constraints;
	audioConstraints?: Constraints;
	mimeType?: BrowserMimeType;
	audioBitsPerSecond?: number;
	videoBitsPerSecond?: number;
	bitsPerSecond?: number;
	frameSize?: number;
	delay?: number;
	retry?: {
		each?: number;
		times?: number;
	};
	streamConfig?: {
		highWaterMarkMB?: number;
		immediateResume?: boolean;
		closeTimeout?: number;
	};
}
export declare function getStream(page: Page, opts: getStreamOptions): Promise<Transform>;
export {};
