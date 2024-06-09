import {functionTypeConstructorName, initLanguage, parseProgram} from "./parsers/program";
import * as fs from "node:fs";
import * as readline from "node:readline";
import {CounterExampleSearcher, DEFAULT_TIMEOUT} from "./engine/counterExampleSearcher";
import {RecursiveFunctionNode} from "./models/symbolic_nodes";
import {TimeoutError} from "./models/errors";

const BENCHMARKS_DIR = "benchmarks"
const SOLUTION_FILE = "sol.sml"
const SUBMISSION_PATTERN = /sub(\d+).sml/

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const prompt = (question: string) => new Promise<string>(resolve => rl.question(question, resolve))

const main = async () => {
    const parser = await initLanguage("src/parsers/sml.wasm");

    const funcNames = fs.readdirSync(BENCHMARKS_DIR)

    console.log("Available benchmarks:")
    funcNames.forEach((name, i) => console.log(`[${i + 1}] ${name}`))

    const selected = parseInt(await prompt("Select a benchmark: ")) - 1
    if (selected < 0 || selected >= funcNames.length || isNaN(selected)) {
        console.log("Invalid benchmark selected.")
        return
    }
    const benchmark = funcNames[selected]
    console.log(`\nSelected benchmark: ${benchmark}`)

    const timeout = parseInt(await prompt(`Enter timeout in seconds (default: ${DEFAULT_TIMEOUT / 1000}): `)) * 1000 || DEFAULT_TIMEOUT

    console.log("Loading benchmark...")

    const submissions = fs.readdirSync(`${BENCHMARKS_DIR}/${benchmark}`)
        .filter(file => SUBMISSION_PATTERN.test(file))
        .sort((a, b) => parseInt(a.match(SUBMISSION_PATTERN)![1]) - parseInt(b.match(SUBMISSION_PATTERN)![1]))
    const solution = fs.readFileSync(`${BENCHMARKS_DIR}/${benchmark}/${SOLUTION_FILE}`, "utf-8")

    const referenceEnv = parseProgram(parser, solution)
    const referenceFun = referenceEnv.bindings.get(benchmark)! as RecursiveFunctionNode
    const targetType = referenceEnv.constructors.get(functionTypeConstructorName(benchmark))!.argType
    const searcher = new CounterExampleSearcher(benchmark, targetType, referenceEnv, referenceFun, timeout)

    console.log("Available submissions:")
    // four columns print
    const columns = 4
    for (let i = 0; i < submissions.length; i += columns) {
        const row = submissions.slice(i, i + columns)
        console.log(row.map((file, j) => `[${i + j + 1}] ${file}`).join("\t\t"))
    }

    const selectedSubmission = parseInt(await prompt("Select a submission: ")) - 1
    if (selectedSubmission < 0 || selectedSubmission >= submissions.length || isNaN(selectedSubmission)) {
        console.log("Invalid submission selected.")
        return
    }

    const submissionName = submissions[selectedSubmission]
    console.log(`\nSelected submission: ${submissionName}`)
    console.log("Loading submission...")
    const submission = fs.readFileSync(`${BENCHMARKS_DIR}/${benchmark}/${submissionName}`, "utf-8")
    const checkedEnv = parseProgram(parser, submission)
    const checkedFun = checkedEnv.bindings.get(benchmark)! as RecursiveFunctionNode

    console.log("Searching for counterexample...")
    try {
        const counterExample = await searcher.search(checkedEnv, checkedFun)
        if (counterExample) {
            console.log("Counterexample found!")
            console.log(`Input: ${counterExample.input}`)
            console.log(`Output: ${counterExample.output}`)
            console.log(`Expected output: ${counterExample.expectedOutput}`)
        } else {
            console.log("No counterexample found.")
        }
    } catch (e) {
        if (e instanceof TimeoutError) {
            console.log("Search timed out.")
            console.log("No counterexample found.")
            return
        }
        if (e instanceof Error && (e.message === "memory access out of bounds" || e.message.startsWith("Aborted"))) {
            console.log("Memory limit reached.")
            console.log("No counterexample found.")
            return
        }
        if (e instanceof Error) {
            console.log(e.message)
        }
        throw e
    } finally {
        process.exit(0)
    }
}

void main()