import Heap from "heap-js";
import {CompoundType, PolymorphicType, PrimitiveType, Type} from "./models/types";
import {HoleNode, RecursiveFunctionNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram} from "./parsers/program";
import {promises as fs} from "fs";
import {Generator} from "./engine/generator";
import {init} from "z3-solver";
import {createCustomContext} from "./models/context";
import {SymbolicExecutor} from "./engine/symbolicExecutor";

const main = async () => {
    const targetType = new CompoundType(PrimitiveType.INT, new PrimitiveType("list"))
    const targetFun = "max"

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const referenceInput = await fs.readFile("test/reference.in", "utf-8")
    const buggyInput = await fs.readFile("test/buggy.in", "utf-8")

    printSection("PARSING")
    const referenceEnv = parseProgram(referenceInput)
    const buggyEnv = parseProgram(buggyInput)

    printSection("SYMBOLIC SUMMARIES")
    const referenceFun = <RecursiveFunctionNode>referenceEnv.bindings.get(targetFun)
    const buggyFun = <RecursiveFunctionNode>buggyEnv.bindings.get(targetFun)

    const {Context, Z3} = await init();
    const context = createCustomContext(Context('main'), Z3)

    const symbolicExecutor = new SymbolicExecutor(context, referenceFun, buggyFun, referenceEnv, buggyEnv)

    printSection("GENERATOR")

    const generator = new Generator(buggyEnv.constructors)
    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()
        if (testCase.isGround()) {
            console.log("CHECKING ", testCase.toString(), testCase.size())
            const checkResult = await symbolicExecutor.check(testCase)
            if (checkResult) {
                console.log("FOUND")
                console.log(testCase.toString())
                console.log(checkResult.toString())
                break
            }
            continue
        }
        generator.generate(testCase, minHeap)

        // if (testCase.size() >= 10) break
    }
    printSection("END")
}

const printSection = (title: string) => {
    console.log("\n\n")
    console.log("=== " + title + " ===")
}

void main()