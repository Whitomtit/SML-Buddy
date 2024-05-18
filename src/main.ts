import Heap from "heap-js";
import {FunctionType, PolymorphicType, PrimitiveType, TupleType, Type} from "./models/types";
import {ConstructorNode, FunctionNode, HoleNode, IntegerNode, SymbolicNode} from "./models/symbolic_nodes";
import {getTupleConstructorName, parseProgram} from "./parsers/program";
import {promises as fs} from "fs";

const main = async () => {
    const targetType = new TupleType([new FunctionType(PrimitiveType.INT, PrimitiveType.INT), new PrimitiveType("int")])

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const program = await fs.readFile("test/test_1.in", "utf-8")

    const env = parseProgram(program)

    env.constructors.forEach((value, key) => {
        console.log(key, value.toString())
    })

    const exp_eval = <FunctionNode>env.bindings.get("exp_eval")
    const res = exp_eval.apply(new ConstructorNode([
            new ConstructorNode([
                    new ConstructorNode([new IntegerNode(5)], "NUM"),
                    new ConstructorNode([new IntegerNode(10)], "NUM")],
                getTupleConstructorName(2))],
        "PLUS"))
    console.log(res.toString())

    const f = <FunctionNode>env.bindings.get("f")
    const res2 = f.apply(new ConstructorNode([], "NIL"))
    console.log(res2.toString())

    const res3 = f.apply(new ConstructorNode([
        new ConstructorNode([
            new IntegerNode(5),
            new ConstructorNode([], "NIL")
        ], getTupleConstructorName(2))
    ], "::"))
    console.log(res3.toString())


    // const { Context } = await init();
    // const { Solver, Int, And } = Context('main');
    //
    // const x = Int.const('x');
    //
    // const solver = new Solver();
    // solver.add(And(x.ge(5), x.le(9)));
    // const result = await solver.check();
    // console.log(solver.model().get(x).toString());


    // while (minHeap.size() > 0) {
    //     const testCase = minHeap.pop()
    //     if (testCase.holesNumber() === 0) {
    //         console.log(testCase.toString())
    //         continue
    //     }
    //     Generator(testCase, minHeap, constructors)
    //     if (testCase.size() >= 20) break
    // }
}

void main()