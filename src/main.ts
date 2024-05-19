import Heap from "heap-js";
import {PolymorphicType, PrimitiveType, Type} from "./models/types";
import {HoleNode, IntegerNode, RecursiveFunctionNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram} from "./parsers/program";
import {promises as fs} from "fs";
import {Generator} from "./engine/generator";
import {init} from "z3-solver";
import {createCustomContext} from "./models/context";

const main = async () => {
    const targetType = PrimitiveType.INT
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
    console.log(test_a.apply(new IntegerNode(2)).toString())
    console.log(test_b.apply(new IntegerNode(2)).toString())

    const {Context, Z3} = await init();
    const context = createCustomContext(Context('main'), Z3)
    const {Solver, Int} = context;

    const solver = new Solver();

    solver.add(context.assert_string_eq("x", "hello"))
    solver.add(context.assert_string_eq("y", "world"))
    solver.add(context.assert_string_eq("x", "hello"))
    await solver.check();
    console.log(solver.model().toString());

    printSection("GENERATOR")

    const generator = new Generator(env.constructors)
    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()
        if (testCase.isGround()) {
            console.log(testCase.toString())
            continue
        }

        generator.generate(testCase, minHeap)

        if (testCase.size() >= 10) break
    }
    printSection("END")
}

const printSection = (title: string) => {
    console.log("\n\n")
    console.log("=== " + title + " ===")
}

void main()