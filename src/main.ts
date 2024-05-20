import Heap from "heap-js";
import {CompoundType, PolymorphicType, PrimitiveType, Type} from "./models/types";
import {HoleNode, IntegerNode, RecursiveFunctionNode, SymbolicNode} from "./models/symbolic_nodes";
import {list, parseProgram} from "./parsers/program";
import {promises as fs} from "fs";
import {Generator} from "./engine/generator";
import {init} from "z3-solver";
import {createCustomContext} from "./models/context";
import {SymbolicExecutor} from "./engine/symbolicExecutor";

const main = async () => {
    const targetType = new CompoundType(PrimitiveType.INT, list)
    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const program = await fs.readFile("test/test_1.in", "utf-8")

    printSection("PARSING")
    const env = parseProgram(program)

    printSection("CONSTRUCTORS")

    env.constructors.forEach((value, key) => {
        console.log(key, value.toString())
    })

    printSection("MAIN RUN")
    const main = <RecursiveFunctionNode>env.bindings.get("main")
    console.log(main.apply(new IntegerNode(5)).toString())

    printSection("SYMBOLIC SUMMARIES")
    const test_a = <RecursiveFunctionNode>env.bindings.get("test_a")
    const test_b = <RecursiveFunctionNode>env.bindings.get("test_b")

    const {Context, Z3} = await init();
    const context = createCustomContext(Context('main'), Z3)

    const symbolicExecutor = new SymbolicExecutor(context, test_b, test_a, env)

    printSection("GENERATOR")

    const generator = new Generator(env.constructors)
    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()
        if (testCase.isGround()) {
            console.log("CHECKING ", testCase.toString())
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