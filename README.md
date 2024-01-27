# Autoindex Code Generator

Create `autoindex.ts` files throughout your codebase and generate an index file that exports all of the siblings.

## Getting Started

```sh
npm install -g @ccorcos/autoindex
```

Given the following directory:

```
src/
	autoindex.ts
	hello.ts
	world.ts
```


Then run `autoindex src`.

And `src/autoindex.ts` will look like:

```ts
import * as hello from "./hello"
import * as world from "./world"

export {
	hello,
	world,
}
```

You can also watch as part of your build system.

```sh
autoindex src --watch
```