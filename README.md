## Installation

```bash
npm i @lachero/node-curl
```

## Usage

```typescript
import curl from '@lachero/node-curl';

const response = await curl('https://jsonplaceholder.typicode.com/posts', {
	method: 'POST',
	data: {
		userId: 1,
	},
});

// or using instance
const curlInstance = curl.createInstance({
	baseUrl: 'https://jsonplaceholder.typicode.com',
	headers: {
		'Content-Type': 'application/json',
		Authorization: 'Bearer token',
	},
	proxy: 'localhost:8080',
});

const response = await curlInstance('/posts', {
	method: 'POST',
	data: {
		userId: 1,
	},
});
```
