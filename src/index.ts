// Imports
import * as Interpreter from "./Interpreter.js";
import nodeFs from "node:fs";

// Constants
const flagUseColor = process.argv.slice(2).includes("-useColor");

// Executes
try {
    // Variables
    let memory = new Map<string, Interpreter.Value>();
    let statements = Interpreter.parse((await nodeFs.promises.readFile(process.argv[2])).toString().replace(/\r?\n/g, ""));

    // Defines Natives
    defineNative("ADD", ADD, memory);
    defineNative("+", ADD, memory);
    defineNative("ATOM", ATOM, memory);
    defineNative("CAR", CAR, memory);
    defineNative("CDR", CDR, memory);
    defineNative("CONS", CONS, memory);
    defineNative("DEF", DEF, memory);
    defineNative("EQ", EQ, memory);
    defineNative("EVAL", EVAL, memory);
    defineNative("EXP", EXP, memory);
    defineNative("DIV", DIV, memory);
    defineNative("/", DIV, memory);
    defineNative("MULT", MULT, memory);
    defineNative("*", MULT, memory);
    defineNative("NEG", NEG, memory);
    defineNative("POS", POS, memory);
    defineNative("PRINT", PRINT, memory);
    defineNative("REVERSE", REVERSE, memory);
    defineNative("SUB", SUB, memory);
    defineNative("-", SUB, memory);
    defineNative("SQUARE", SQUARE, memory);
    defineNative("SET", SET, memory);
    defineNative("SETQ", SETQ, memory);

    // Executes
    for(let i = 0; i < statements.length; i++) Interpreter.execute(statements[i], memory);
}
catch(error) {
    console.log((flagUseColor ? "\x1b[91mFATAL ERROR\x1b[0m" : "FATAL ERROR"));
    console.log("\t" + (error instanceof Error ? error.message : String(error)))
}

// Functions
function defineNative(name: string, method: Interpreter.Native["value"], memory: Interpreter.Memory): void {
    memory.set(name.toUpperCase(), { escaped: false, parent: null, type: "NATIVE", value: method });
}

function getNil(): Interpreter.Nil {
    return { escaped: false, parent: null, type: "LIST", value: [] };
}

function getTrue(): Interpreter.True {
    return { escaped: false, parent: null, type: "ATOM", value: "TRUE" };
}

function isTrue(parameter: Interpreter.Value): boolean {
    return parameter.type === "ATOM" && parameter.value.toUpperCase() === "TRUE";
}

function isNil(parameter: Interpreter.Value): boolean {
    return (parameter.type === "LIST" && !parameter.value.length);
}

function toString(parameter: Interpreter.Value, memory: Interpreter.Memory, useColor: boolean = false): string {
    let value = Interpreter.fetch(parameter, memory);
    switch(value.type) {
        case "ATOM": {
            if(useColor) {
                if(isTrue(value) || !isNaN(Number(value.value))) return `\x1b[93m${value.value}\x1b[0m`;
                if(isNil(value)) return `\x1b[90m${value.value}\x1b[0m`;
                return `\x1b[32m${value.value}\x1b[0m`;
            }
            return value.value;
        }
        case "LIST": {
            if(!value.value.length) return useColor ? "\x1b[90mNIL\x1b[0m" : "NIL";
            if(value.escaped) return `( ${value.value.map(element => toString(element, memory, useColor)).join(" ")} )`;
            return toString(Interpreter.execute(value, memory), memory);
        }
        case "METHOD": return useColor ?
            `\x1b[96m<Function: ${value.value[0].value}>\x1b[0m` :
            `<Function: ${value.value[0].value}>`;
        case "NATIVE": return useColor ?
            `\x1b[96m<Native: ${value.value.name}>\x1b[0m` :
            `<Native: ${value.value.name}>`;
        default: throw new Error("Unknown parameter type.");
    }
}

// Natives
function ADD(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Atom {
    if(parameters.length < 2) throw new Error(`ADD: Expected 2 or more arguments, got ${parameters.length} instead.`);
    let sum = 0;
    for(let i = 0; i < parameters.length; i++) {
        let value = Number(Interpreter.fetch(parameters[i], memory).value);
        if(isNaN(value)) throw new Error("ADD: One or more parameters are not a number");
        sum += value;
    }
    return { escaped: false, parent: parameters[0].parent, type: "ATOM", value: String(sum) };
}

function ATOM(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Boolean {
    if(parameters.length !== 1) throw new Error(`ATOM: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Interpreter.fetch(parameters[0], memory);
    return (value.type === "ATOM" || isTrue(value) || isNil(value)) ? getTrue() : getNil();
}

function CAR(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Value {
    if(parameters.length !== 1) throw new Error(`CAR: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Interpreter.fetch(parameters[0], memory);
    if(value.type !== "LIST" || !value.value.length) throw new Error("CAR: Parameter must be a non-NIL list.");
    return {
        escaped: value.value[0].escaped,
        parent: parameters[0].parent,
        type: value.value[0].type,
        value: value.value[0].value
    } as Interpreter.Value;
}

function CDR(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.List {
    if(parameters.length !== 1) throw new Error(`CDR: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Interpreter.fetch(parameters[0], memory);
    if(value.type !== "LIST" || !value.value.length) throw new Error("CDR: Parameter must be a non-NIL list.");
    return {
        escaped: true,
        parent: parameters[0].parent,
        type: "LIST",
        value: Array.from(value.value.slice(1)).map(element => {
            return {
                escaped: element.escaped,
                parent: parameters[0],
                type: element.type,
                value: element.value
            } as Interpreter.Parameter;
        })
    };
}

function CONS(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.List {
    if(parameters.length !== 2) throw new Error(`CONS: Expected 2 arguments, got ${parameters.length} instead.`);
    let left = Interpreter.fetch(parameters[0], memory);
    let right = Interpreter.fetch(parameters[1], memory);
    if(right.type !== "LIST") throw new Error("CONS: Parameter must be a list.");
    return {
        escaped: true,
        parent: parameters[0].parent,
        type: "LIST",
        value: [ left, ...right.value ].map(element => {
            return {
                escaped: element.escaped,
                parent: parameters[0],
                type: element.type,
                value: element.value
            } as Interpreter.Parameter;
        })
    };
}

function DEF(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Method {
    if(parameters.length !== 3) throw new Error(`DEF: Expected 3 arguments, got ${parameters.length} instead.`);
    let methodName = parameters[0];
    let methodParameters = parameters[1];
    let methodDefinition = parameters[2];
    if(methodName.type !== "ATOM" || methodName.escaped) throw new Error("DEF: Illegal function name.");
    if(
        methodParameters.type !== "LIST" || methodParameters.escaped ||
        methodParameters.value.length !== 1 || methodParameters.value[0].type !== "ATOM"
    )
        throw new Error("DEF: Illegal function arguments.");
    if(methodDefinition.type !== "LIST" || methodDefinition.escaped)
        throw new Error("DEF: Illegal function definition.");
    let method: Interpreter.Method = {
        escaped: false,
        parent: parameters[0].parent,
        type: "METHOD",
        value: [ methodName, methodParameters as Interpreter.List & { value: [ Interpreter.Atom ] }, methodDefinition ]
    };
    memory.set(methodName.value.toUpperCase(), method);
    return method;
}

function DIV(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Atom {
    if(parameters.length !== 2) throw new Error(`DIV: Expected 2 arguments, got ${parameters.length} instead.`);
    let dividend = Number(Interpreter.fetch(parameters[0], memory).value);
    let divisor = Number(Interpreter.fetch(parameters[1], memory).value);
    if(isNaN(dividend)) throw new Error("DIV: Dividend is not a number");
    if(isNaN(divisor)) throw new Error("DIV: Divisor is not a number");
    return { escaped: false, parent: parameters[0].parent, type: "ATOM", value: String(dividend / divisor) };
}

function EQ(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Boolean {
    if(parameters.length !== 2) throw new Error(`EQ: Expected 2 arguments, got ${parameters.length} instead.`);
    let left = Number(Interpreter.fetch(parameters[0], memory).value);
    let right = Number(Interpreter.fetch(parameters[1], memory).value);
    if(isNaN(left)) throw new Error("EQ: Left-hand parameter is not a number");
    if(isNaN(right)) throw new Error("EQ: Right-hand parameter is not a number");
    return left === right ? getTrue() : getNil();
}

function EVAL(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Value {
    if(parameters.length !== 1) throw new Error(`EVAL: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Interpreter.fetch(parameters[0], memory);
    if(value.type === "LIST") return Interpreter.execute({
        escaped: false,
        parent: parameters[0].parent,
        type: "LIST",
        value: Array.from(value.value).map(element => {
            return {
                escaped: element.escaped,
                parent: parameters[0],
                type: element.type,
                value: element.value
            } as Interpreter.Parameter;
        })
    }, memory);
    return value;
}

function EXP(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Atom {
    if(parameters.length !== 2) throw new Error(`EXP: Expected 2 arguments, got ${parameters.length} instead.`);
    let base = Number(Interpreter.fetch(parameters[0], memory).value);
    let exponent = Number(Interpreter.fetch(parameters[1], memory).value);
    if(isNaN(base)) throw new Error("EXP: Base is not a number");
    if(isNaN(exponent)) throw new Error("EXP: Exponent is not a number");
    return { escaped: false, parent: parameters[0].parent, type: "ATOM", value: String(base ** exponent) };
}

function MULT(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Atom {
    if(parameters.length < 2) throw new Error(`MULT: Expected 2 or more arguments, got ${parameters.length} instead.`);
    let product = 1;
    for(let i = 0; i < parameters.length; i++) {
        let value = Number(Interpreter.fetch(parameters[i], memory).value);
        if(isNaN(value)) throw new Error("MULT: One or more parameters are not a number");
        product *= value;
    }
    return { escaped: false, parent: parameters[0].parent, type: "ATOM", value: String(product) };
}

function NEG(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Boolean {
    if(parameters.length !== 1) throw new Error(`NEG: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Number(Interpreter.fetch(parameters[0], memory).value);
    if(isNaN(value)) throw new Error("NEG: Parameter is not a number");
    return value < 0 ? getTrue() : getNil();
}

function POS(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Boolean {
    if(parameters.length !== 1) throw new Error(`POS: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Number(Interpreter.fetch(parameters[0], memory).value);
    if(isNaN(value)) throw new Error("POS: Parameter is not a number");
    return value >= 0 ? getTrue() : getNil();
}

function PRINT(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Nil {
    for(let i = 0; i < parameters.length; i++) process.stdout.write(toString(parameters[i], memory, flagUseColor) + " ");
    process.stdout.write("\n");
    return getNil();
}

function REVERSE(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.List {
    if(parameters.length !== 1) throw new Error(`REVERSE: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Interpreter.fetch(parameters[0], memory);
    if(value.type !== "LIST") throw new Error("REVERSE: Parameter must be a list.");
    return {
        escaped: true,
        parent: parameters[0].parent,
        type: "LIST",
        value: Array.from(value.value).map(element => {
            return {
                escaped: element.escaped,
                parent: parameters[0],
                type: element.type,
                value: element.value
            } as Interpreter.Parameter;
        }).reverse()
    };
}

function SQUARE(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Atom {
    if(parameters.length !== 1) throw new Error(`SQUARE: Expected 1 argument, got ${parameters.length} instead.`);
    let value = Number(Interpreter.fetch(parameters[0], memory).value);
    if(isNaN(value)) throw new Error("SQUARE: Parameter is not a number");
    return { escaped: false, parent: parameters[0].parent, type: "ATOM", value: String(value * value) };
}

function SUB(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Atom {
    if(parameters.length !== 2) throw new Error(`SUB: Expected 2 arguments, got ${parameters.length} instead.`);
    let minuend = Number(Interpreter.fetch(parameters[0], memory).value);
    let subtrahend = Number(Interpreter.fetch(parameters[1], memory).value);
    if(isNaN(minuend)) throw new Error("SUB: Minuend is not a number");
    if(isNaN(subtrahend)) throw new Error("SUB: Subtrahend is not a number");
    return { escaped: false, parent: parameters[0].parent, type: "ATOM", value: String(minuend - subtrahend) };
}

function SET(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Value {
    if(parameters.length !== 2) throw new Error(`SET: Expected 2 arguments, got ${parameters.length} instead.`);
    let key = Interpreter.fetch(parameters[0], memory);
    let value = Interpreter.fetch(parameters[1], memory);
    if(
        key.type !== "ATOM" || !key.escaped ||
        isTrue(key) || isNil(key)
    )
        throw new Error("SET: Left-hand parameter is illegal.");
    memory.set(key.value.toUpperCase(), value);
    return value;
}

function SETQ(parameters: Interpreter.Value[], memory: Interpreter.Memory): Interpreter.Value {
    if(parameters.length !== 2) throw new Error(`SETQ: Expected 2 arguments, got ${parameters.length} instead.`);
    let value = Interpreter.fetch(parameters[1], memory);
    if(
        parameters[0].type !== "ATOM" || parameters[0].escaped ||
        isTrue(parameters[0]) || isNil(parameters[0])
    )
        throw new Error("SETQ: Left-hand parameter is illegal.");
    memory.set(parameters[0].value.toUpperCase(), value);
    return value;
}