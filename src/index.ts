import { spawn } from 'node:child_process';
import merge from 'lodash.merge';
import CurlError from './CurlError';
export { default as CurlError } from './CurlError';

export type Opts = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	headers?: Record<string, string>;
	body?: string | Record<string, any> | any[] | null | boolean | number;
	proxy?: string;
	shouldRetry?(error: string): boolean | PromiseLike<boolean>;
	maxRetries?: number;
};

export type InstanceOpts = {
	baseUrl?: string;
	headers?: Record<string, string>;
	proxy?: string;
};

export type CurlHeaders = { [key: string]: string } & {
	'set-cookie'?: string[];
};

export type CurlResponse<T> = {
	statusCode: number;
	headers: CurlHeaders;
	body: T;
};

async function curl<T>(url: string, opts?: Opts): Promise<CurlResponse<T>> {
	const args = [
		'--silent', //
		'--show-error',
		'--include',
		'--request',
		opts?.method ?? 'GET',
		'--url',
		url,
	];

	if (opts?.proxy) {
		args.push('--proxy', opts.proxy);
	}

	for (const [key, value] of Object.entries(opts?.headers ?? {})) {
		args.push('--header', `${key}: ${value}`);
	}

	if (opts?.body) {
		let body = opts.body;
		if (typeof opts.body === 'object') {
			body = JSON.stringify(opts.body);
			args.push('--header', 'Content-Type: application/json');
		}
		args.push('--data', body.toString());
	}

	const MAX_RETRIES = opts?.maxRetries ?? 3;
	let retries = 0;

	const doRequest = async (): Promise<CurlResponse<T>> => {
		const curl = spawn('curl', args);

		return new Promise((resolve, reject) => {
			let data = '';
			let error = '';

			curl.stdout.on('data', chunk => {
				data += chunk;
			});

			curl.stderr.on('data', chunk => {
				error += chunk;
			});

			curl.on('close', async code => {
				if (code === 0) {
					const blocks = data.split('\r\n\r\n');
					if (opts?.proxy) {
						blocks.shift();
					}
					const [headAsString, bodyAsString] = blocks as [string, string];
					const headLines = headAsString.split('\r\n');
					const statusCode = parseInt(headLines.shift()?.split(' ')[1] ?? '0');

					const headers = headLines.reduce((acc, line) => {
						const [key, value] = line.split(': ') as [string, string];
						const keyLowerCase = key.toLowerCase();
						if (keyLowerCase === 'set-cookie') {
							acc[keyLowerCase] = acc[keyLowerCase] ?? [];
							acc[keyLowerCase].push(value);
						} else {
							acc[keyLowerCase] = value;
						}
						return acc;
					}, {} as CurlHeaders);

					let body: T = bodyAsString as unknown as T;
					if (headers['content-type']?.startsWith('application/json')) {
						body = JSON.parse(bodyAsString) as T;
					}

					resolve({ statusCode, headers, body });
				} else {
					retries++;
					if (retries < MAX_RETRIES && opts?.shouldRetry && (await opts.shouldRetry(error))) {
						return doRequest();
					}

					reject(new CurlError(error, { url, opts, retries, MAX_RETRIES, exitCode: code, curlArgs: args }));
				}
			});
		});
	};

	return doRequest();
}

function createInstance(instanceOpts: InstanceOpts) {
	return <T>(url: string, opts?: Opts) => {
		const reqUrl = instanceOpts.baseUrl ? `${instanceOpts.baseUrl}${url}` : url;
		return curl<T>(reqUrl, merge({}, instanceOpts, opts));
	};
}

curl.createInstance = createInstance;

export default curl;
