/**
 * Bytecode Expression Compiler & Virtual Machine for TaskQL.
 * Compiles mathematical and boolean AST expressions into a compact bytecode stream
 * executed by a stack-based virtual machine, bypassing recursive AST evaluation.
 */

export enum Opcode {
  LOAD_CONST = 1,
  LOAD_VAR = 2,
  ADD = 3,
  SUB = 4,
  MUL = 5,
  DIV = 6,
  EQ = 7,
  NEQ = 8,
  GT = 9,
  GTE = 10,
  LT = 11,
  LTE = 12,
  AND = 13,
  OR = 14,
  NOT = 15,
}

export interface Instruction {
  op: Opcode;
  arg?: any;
}

export class ExpressionCompiler {
  private constants: any[] = [];
  private instructions: Instruction[] = [];

  public emit(op: Opcode, arg?: any): void {
    this.instructions.push({ op, arg });
  }

  public getInstructions(): Instruction[] {
    return [...this.instructions];
  }

  /**
   * Executes the compiled bytecode instructions against a variable scope.
   */
  public execute(scope: Record<string, any>): any {
    const stack: any[] = [];

    for (const inst of this.instructions) {
      switch (inst.op) {
        case Opcode.LOAD_CONST:
          stack.push(inst.arg);
          break;

        case Opcode.LOAD_VAR:
          stack.push(scope[inst.arg] ?? null);
          break;

        case Opcode.ADD: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Number(a) + Number(b));
          break;
        }

        case Opcode.SUB: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Number(a) - Number(b));
          break;
        }

        case Opcode.MUL: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Number(a) * Number(b));
          break;
        }

        case Opcode.DIV: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Number(b) !== 0 ? Number(a) / Number(b) : null);
          break;
        }

        case Opcode.EQ: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a === b);
          break;
        }

        case Opcode.NEQ: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a !== b);
          break;
        }

        case Opcode.GT: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a > b);
          break;
        }

        case Opcode.GTE: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a >= b);
          break;
        }

        case Opcode.LT: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a < b);
          break;
        }

        case Opcode.LTE: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a <= b);
          break;
        }

        case Opcode.AND: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Boolean(a) && Boolean(b));
          break;
        }

        case Opcode.OR: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Boolean(a) || Boolean(b));
          break;
        }

        case Opcode.NOT: {
          const a = stack.pop();
          stack.push(!a);
          break;
        }
      }
    }

    return stack.pop();
  }
}
