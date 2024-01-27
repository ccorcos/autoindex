import chokidar from "chokidar"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { autoindex } from "./autoindex"

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
