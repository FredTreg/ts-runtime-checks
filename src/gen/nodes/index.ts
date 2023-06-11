import ts from "typescript";
import { NumberTypes, TypeDataKinds, Validator } from "../validators";
import { _and, _bin, _bin_chain, _for, _if, _new, _not, _num, _or, _str, _throw, _typeof_cmp, BlockLike, UNDEFINED, concat, joinElements, Stringifyable, _if_chain } from "../expressionUtils";
import { Transformer } from "../../transformer";

export interface ValidationResultType {
    throw?: boolean,
    return?: ts.Expression,
    returnErr?: boolean,
    custom?: (msg: ts.Expression) => ts.Statement
}

export interface NodeGenContext {
    transformer: Transformer,
    errorTypeName: string,
    resultType: ValidationResultType
}

export type GenResultError = [path: Stringifyable[], message: ts.Expression[]];

export interface GenResult {
    condition: ts.Expression,
    error?: GenResultError,
    ifTrue?: BlockLike,
    ifFalse?: BlockLike,
    extra?: ts.Statement[]
}

export function emptyGenResult() : GenResult {
    return {
        condition: ts.factory.createNull(),
        error: [[], []]
    };
}

export function error(ctx: NodeGenContext, error: GenResultError) : ts.Statement {
    const finalMsg = _bin_chain(joinElements(["Expected ", ...error[0], " ", ...error[1]]), ts.SyntaxKind.PlusToken);
    if (ctx.resultType.return) return ts.factory.createReturnStatement(ctx.resultType.return);
    if (ctx.resultType.returnErr) return ts.factory.createReturnStatement(finalMsg);
    else if (ctx.resultType.custom) return ctx.resultType.custom(finalMsg);
    else return _throw(_new(ctx.errorTypeName, [finalMsg]));
}

export function genNode(validator: Validator, ctx: NodeGenContext) : GenResult {
    switch (validator.typeData.kind) {
    case TypeDataKinds.Number: {
        if (validator.typeData.literal) return {
            condition: _bin(validator.expression(), _num(validator.typeData.literal), ts.SyntaxKind.EqualsEqualsEqualsToken),
            error: [validator.path(), concat`to be equal to ${validator.typeData.literal.toString()}`]
        };
        const errorMessages = [];
        const checks: ts.Expression[] = [_typeof_cmp(validator.expression(), "number", ts.SyntaxKind.ExclamationEqualsEqualsToken)];
        if (validator.typeData.type === NumberTypes.Integer) {
            checks.push(_bin(_bin(validator.expression(), _num(1), ts.SyntaxKind.PercentToken), _num(0), ts.SyntaxKind.ExclamationEqualsEqualsToken));
            errorMessages.push("to be an integer");
        }
        else if (validator.typeData.type === NumberTypes.Float) {
            checks.push(_bin(_bin(validator.expression(), _num(1), ts.SyntaxKind.PercentToken), _num(0), ts.SyntaxKind.EqualsEqualsEqualsToken));
            errorMessages.push("to be a float");
        } else {
            errorMessages.push("to be a number");
        }

        if (validator.typeData.min !== undefined) {
            checks.push(_bin(validator.expression(), validator.typeData.min, ts.SyntaxKind.LessThanToken));
            errorMessages.push(...concat`to be greater than ${validator.typeData.min}`);
        }

        if (validator.typeData.max !== undefined) {
            checks.push(_bin(validator.expression(), validator.typeData.max, ts.SyntaxKind.GreaterThanToken));
            errorMessages.push(...concat`to be less than ${validator.typeData.max}`);
        }

        return {
            condition: _or(checks),
            error: [validator.path(), joinElements(errorMessages, ", ")]
        };
    }
    case TypeDataKinds.Union: {
        const compoundTypes = [], normalTypeConditions: ts.Expression[] = [], normalTypeErrors: ts.Expression[] = [], typeNames = [];
        let isNullable = false;
        for (const child of validator.children) {
            if (child.typeData.kind === TypeDataKinds.Undefined) {
                isNullable = true;
                continue;
            }
            else if (child.children.length) compoundTypes.push(genNode(child, ctx));
            else {
                const node = genNode(child, ctx);
                normalTypeConditions.push(node.condition);
                if (node.error) normalTypeErrors.push(...node.error[1]);
            }
            typeNames.push(ctx.transformer.checker.typeToString(child._original));
        }
        return {
            condition: isNullable ? _and([isNullableNode(validator), ...normalTypeConditions]) : _and(normalTypeConditions),
            error: [validator.path(), joinElements(normalTypeErrors, " or ")],
            ifFalse: compoundTypes.length ? _if_chain(0, compoundTypes.map(t => [_not(t.condition), t.extra || []]), error(ctx, [validator.path(), [_str("to be one of "), _str(typeNames.join(", "))]])) : undefined
        };
    }
    case TypeDataKinds.Array: {
        // TDB: Handle array limitations
        const index = ts.factory.createUniqueName("i");
        const childType = validator.children[0] as Validator;
        childType.setName(index);
        return {
            condition: _typeof_cmp(validator.expression(), "Array", ts.SyntaxKind.ExclamationEqualsEqualsToken),
            error: [validator.path(), [_str("to be an array")]],
            extra: [_for(validator.expression(), index, validateType(childType, ctx))[0]]
        };
    }
    case TypeDataKinds.Object: {
        //TBD: Handle exactProps
        const checks: ts.Statement[] = [];
        for (const child of validator.children) {
            checks.push(...validateType(child, ctx));
        }
        return {
            condition: _typeof_cmp(validator.expression(), "object", ts.SyntaxKind.ExclamationEqualsEqualsToken),
            error: [validator.path(), [_str("to be an object")]],
            extra: checks
        };
    }
    default: return emptyGenResult();
    }
}

export function isNullableNode(validator: Validator) : ts.Expression {
    return validator.parent ? _bin(_str(validator.name.toString()), validator.parent.expression(), ts.SyntaxKind.InKeyword) : _bin(validator.expression(), UNDEFINED, ts.SyntaxKind.ExclamationEqualsEqualsToken);
}

export function generateStatements(results: GenResult[], ctx: NodeGenContext) : ts.Statement[] {
    const result = [];
    for (const genResult of results) {
        result.push(_if(genResult.condition, (genResult.error ? error(ctx, genResult.error) : genResult.ifTrue) as BlockLike, genResult.ifFalse));
        if (genResult.extra) result.push(...genResult.extra);
    }
    return result;
}

export function validateType(validator: Validator, ctx: NodeGenContext, isOptional?: boolean) : ts.Statement[] {
    const node = genNode(validator, ctx);
    // TBD: Handle nodes which procuce multiple statement (via .extra)
    return generateStatements([isOptional ? {
        ...node,
        condition: _and([isNullableNode(validator), node.condition])
    } : node], ctx);
}