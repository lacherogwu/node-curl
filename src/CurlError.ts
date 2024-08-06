export default class CurlError extends Error {
	constructor(message: string, public config: Record<string, any>) {
		super(message);
	}
}
