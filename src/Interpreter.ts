// Definitions
export interface Atom {
    escaped: boolean;
    parent: List | null;
    type: "ATOM";
    value: string;
}
export interface List {
    escaped: boolean;
    parent: List | null;
    type: "LIST";
    value: Parameter[]
}
export interface Method {
    escaped: false;
    parent: List | null;
    type: "METHOD";
    value: [ Atom, List & { value: [ Atom ] }, List ]
}
export interface Native {
    escaped: false;
    parent: null;
    type: "NATIVE";
    value: (parameters: Value[], memory: Memory) => Value;
}
export type Boolean = Nil | True;
export type Memory = Map<string, Value>;
export type Nil = List & { value: never[] };
export type True = Atom & { value: "TRUE" };
export type Parameter = Atom | List;
export type Value = Atom | List | Method | Native;

// Functions
export function parse(program: string): List[] {
    let atom: Atom | null = null;
    let escaped = false;
    let list: List | null = null;
    let statements: List[] = [];    
    for(let i = 0; i < program.length; i++) {
        let cursor = program[i];
        switch(cursor) {
            case "'": {
                if(atom) throw new SyntaxError("Cannot escape in the middle of an atom.");
                escaped = true;
                break;
            }
            case "(": {
                list = { escaped, parent: list, type: "LIST", value: [] };
                if(list.parent) {
                    if(atom) {
                        list.parent.value.push(atom);
                        atom = null;
                    }
                    list.parent.value.push(list);
                }
                escaped = false;
                break;
            }
            case ")": {
                if(!list) throw new SyntaxError("Unexpected closing parenthesis. Perhaps you added an extra ')'?");
                if(!list.parent) statements.push(list);
                if(atom) {
                    list.value.push(atom);
                    atom = null;
                }
                list = list.parent;
                break;
            }
            case " ": {
                if(atom) {
                    if(!list) throw new SyntaxError("Cannot declare atom outside of a statement.");
                    list.value.push(atom);
                    atom = null;
                }
                break;
            }
            default: {
                if(!atom) {
                    if(!list) throw new SyntaxError("Cannot declare atom outside of a statement.");
                    atom = { escaped: escaped || list.escaped, parent: list, type: "ATOM", value: cursor };
                    escaped = false;
                }
                else atom.value += cursor;
                break;
            }
        }
    }
    if(list) throw new SyntaxError("Unclosed statement. Perhaps you missed a ')'?");
    return statements;
}

export function fetch(parameter: Value, memory: Memory): Value {
    if(
        parameter.type === "ATOM" &&
        !parameter.escaped &&
        parameter.value.toUpperCase() !== "TRUE" &&
        parameter.value.toUpperCase() !== "NIL" &&
        isNaN(Number(parameter.value))
    ) {
        let variable = memory.get(parameter.value.toUpperCase());
        if(!variable) throw new Error(`Unknown variable '${parameter.value}'.`);
        return variable;
    }
    else if(parameter.type === "ATOM" && parameter.value.toUpperCase() === "NIL") return {
        escaped: false,
        parent: parameter.parent,
        type: "LIST",
        value: []
    }
    else if(parameter.type === "LIST" && !parameter.escaped && parameter.value.length)
        return fetch(execute(parameter, memory), memory);
    else return parameter;
}

export function execute(list: List, memory: Memory): Value {
    if(list.escaped || !list.value.length) return list;
    if(list.value[0].type === "LIST") throw new Error("A function call cannot be a list.");
    let methodName = list.value[0].value;
    let method = memory.get(methodName.toUpperCase());
    if(!method) {
        if(/^C[AD]+R$/.test(methodName.toUpperCase())) {
            let result: Parameter[] = list.value.slice(1);
            let CAR = memory.get("CAR") as Native | undefined;
            let CDR = memory.get("CDR") as Native | undefined;
            if(!CAR || !CDR) throw new Error("CAR or CDR not defined natively.");
            for(let i = methodName.length - 2; i >= 1; i--)
                result = [ (methodName[i] === "A" ? CAR : CDR).value(result, memory) as Parameter ];
            return result[0];
        }
        throw new Error(`Unknown function call '${methodName}'.`);
    }
    if(method.type === "NATIVE") return method.value(list.value.slice(1), memory);
    else if(method.type === "METHOD") {
        if(list.value.length < 2) throw new Error("A non-native function call must contain an argument.");
        return execute(method.value[2], new Map(memory).set(method.value[1].value[0].value.toUpperCase(), fetch(list.value[1], memory)));
    }
    else throw new Error(`Illegal function call '${methodName}'.`);
}
