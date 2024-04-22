import Heap from "heap-js";
import {FunctionType, PolymorphicType, PrimitiveType, TupleType, Type} from "./models/types";
import {HoleNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram} from "./parsers/program";
import {Generator} from "./engine/generator";

const a = new PolymorphicType()
const b = new PolymorphicType()
const c = new PolymorphicType()

const defaultConstructors = new Map<string, FunctionType>([
    ['T2', new FunctionType(new TupleType([a, b]), new TupleType([a, b]))],
    ['T3', new FunctionType(new TupleType([a, b, c]), new TupleType([a, b, c]))]
])

const program = "val 'a x = nil;\n" +
    "datatype a = A | B of int;\n" +
    "datatype mass = KG of int | LB of int;"

const main = async () => {
    const targetType = new TupleType([new FunctionType(PrimitiveType.INT, PrimitiveType.INT), new PrimitiveType("int")])

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const constructors =
        new Map<string, FunctionType>([...defaultConstructors, ...parseProgram(program)])

    constructors.forEach((value, key) => {
        console.log(key, value.toString())
    })

    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()
        if (testCase.holesNumber() === 0) {
            console.log(testCase.toString())
            continue
        }
        Generator(testCase, minHeap, constructors)
        if (testCase.size() >= 20) break
    }
}

void main()