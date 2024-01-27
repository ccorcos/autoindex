import * as fs from "fs/promises"
import { camelCase } from "lodash"
import * as path from "path"

import chokidar from "chokidar"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const argv = yargs(hideBin(process.argv)).argv

const [dirPath] = argv["_"]

if (!dirPath) {
	console.log(`USAGE: autoindex <dirPath> [--watch]`)
	process.exit(0)
}

const watch = argv.w || argv.watch

if (watch) {
	autoindex(dirPath).then(() => {
		const watcher = chokidar.watch(dirPath, {
			// Ignore dotfiles
			ignored: /(^|[\/\\])\../,
			persistent: true,
			ignoreInitial: true, // ignore the initial add events
			depth: Infinity, // Recursively watch
		})
		watcher.on("add", (path) => autoindex(dirPath))
		watcher.on("unlink", (path) => autoindex(dirPath))
		watcher.on("error", (error) => console.error(`Watcher error: ${error}`))
	})
} else {
	autoindex(dirPath)
}

async function autoindex(startDirPath: string) {
	// Find all the autoindex files
	const files = await findAutoIndexFiles(startDirPath)
	await Promise.all(
		files.map(async (file) => {
			let contents = await getAutoIndexFileContents(file)
			await fs.writeFile(file, contents)
			console.log(file)
		})
	)
}

async function findAutoIndexFiles(startDirPath: string) {
	// Find all the autoindex files
	const files: string[] = []
	for await (const item of crawlDir(startDirPath)) {
		if (item.type !== "file") continue
		const parsed = path.parse(item.path)
		if (parsed.name !== "autoindex") continue
		if (!validExt.has(parsed.ext)) continue
		files.push(item.path)
	}
	return files
}

async function getAutoIndexFileContents(autoIndexFilePath: string) {
	const dirPath = path.parse(autoIndexFilePath).dir

	const names = await fs.readdir(dirPath)

	const autoIndexName = names.find((name) => name.startsWith("autoindex"))
	if (!autoIndexName)
		throw new Error("Could not find autoindex file in dir " + dirPath)

	const fileNames = names
		.map((name) => path.parse(name))
		.filter((parsed) => {
			if (parsed.name === "autoindex") return false
			return validExt.has(parsed.ext)
		})

	const header = `/* WARNING: this file is generated! */`
	const imports = fileNames
		.map(
			(fileName) =>
				`import * as ${cleanFileName(fileName.name)} from "./${fileName.name}"`
		)
		.join("\n")

	const body = fileNames
		.map((fileName) => cleanFileName(fileName.name))
		.join(",\n\t")
	const exportBody = `export {\n\t${body},\n}`
	return [header, imports, exportBody].join("\n\n") + "\n"
}

const validExt = new Set([".ts", ".tsx", ".js", ".jsx"])

// > path.parse("/users/chet/apple.ts")
// {
//   root: '/',
//   dir: '/users/chet',
//   base: 'apple.ts',
//   ext: '.ts',
//   name: 'apple'
// }

function cleanFileName(fileName: string) {
	if (fileName.indexOf("-") !== -1 || fileName.indexOf("_") !== -1) {
		return camelCase(fileName)
	} else {
		return fileName
	}
}

type FileSystemEntry = {
	type: "file" | "folder"
	path: string
}

async function* crawlDir(startPath: string): AsyncGenerator<FileSystemEntry> {
	const queue: string[] = [startPath]

	while (queue.length > 0) {
		const currentPath = queue.shift()!
		let stats: Awaited<ReturnType<typeof fs.stat>>

		try {
			stats = await fs.stat(currentPath)
		} catch (error) {
			console.error(`Error reading ${currentPath}:`, error)
			continue
		}

		if (stats.isDirectory()) {
			yield { type: "folder", path: currentPath }

			let dir: string[]
			try {
				dir = await fs.readdir(currentPath)
			} catch (error) {
				console.error(`Error reading contents of ${currentPath}:`, error)
				continue
			}

			for (const entry of dir) {
				queue.push(path.join(currentPath, entry))
			}
		} else if (stats.isFile()) {
			yield { type: "file", path: currentPath }
		}
	}
}
