import { promises as fs } from "fs"
import core from "@actions/core"
import { getOctokit } from "@actions/github"

import { parse } from "./clover"
import { diff } from "./comment"

async function main() {
	const token = core.getInput("github-token")
	const cloverFile = core.getInput("clover-file") || "./coverage/clover.xml"
	const baseFile = core.getInput("clover-base")

	const raw = await fs.readFile(cloverFile, "utf-8").catch(err => null)
	if (!raw) {
		console.log(`No coverage report found at '${cloverFile}', exiting...`)
		return
	}

	const baseRaw =
		baseFile && (await fs.readFile(baseFile, "utf-8").catch(err => null))
	if (baseFile && !baseRaw) {
		console.log(`No coverage report found at '${baseFile}', ignoring...`)
	}

	console.log("oi")

	const options = {
		repository: context.payload.repository.full_name,
		prefix: `${process.env.GITHUB_WORKSPACE}/`,
	}

	if (context.eventName === "pull_request") {
		options.commit = context.payload.pull_request.head.sha
		options.head = context.payload.pull_request.head.ref
		options.base = context.payload.pull_request.base.ref
	} else if (context.eventName === "push") {
		options.commit = context.payload.after
		options.head = context.ref
	}

	const clover = await parse(raw)
	console.log("oi2")
	const baseclover = baseRaw && (await parse(baseRaw))
	console.log("oi3")
	const body = diff(clover, baseclover, options)

	const gitub = getOctokit(token)
	console.log("oi4")

	if (context.eventName === "pull_request") {
		await github.issues.createComment({
			repo: context.repo.repo,
			owner: context.repo.owner,
			issue_number: context.payload.pull_request.number,
			body,
		})
	} else if (context.eventName === "push") {
		await github.repos.createCommitComment({
			repo: context.repo.repo,
			owner: context.repo.owner,
			commit_sha: options.commit,
			body,
		})
	}
}

main().catch(function(err) {
	console.log(err)
	core.setFailed(err.message)
})
