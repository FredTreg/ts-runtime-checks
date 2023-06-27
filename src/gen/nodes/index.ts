import ts from "typescript";
import { NumberTypes, ObjectTypeDataExactOptions, TypeDataKinds, Validator } from "../validators";
import { _and, _bin, _bin_chain, _for, _if, _new, _not, _num, _or, _str, _throw, _typeof_cmp, BlockLike, UNDEFINED, concat, joinElements, Stringifyable, _if_nest, _instanceof, _access, _call, _for_in, _ident, _bool, _obj_check } from "../expressionUtils";
import { Transformer } from "../../transformer";

export interface ValidationResultType {
    throw?: string,
    return?: ts.Expression,
    returnErr?: boolean,
    custom?: (msg: ts.Expression) => ts.Statement,
    none?: boolean
}

export interface NodeGenContext {
    transformer: Transformer,
    resultType: ValidationResultType
}

export type GenResultError = [path: Stringifyable[], message: ts.Expression[]];

export interface GenResult {
    condition: ts.Expression,
    error?: GenResultError,
    ifTrue?: BlockLike,
    ifFalse?: BlockLike,
    extra?: ts.Statement[],
    minimzed?: boolean
}

export function emptyGenResult() : GenResult {
    return {
        condition: ts.factory.createNull(),
        error: [[], []]
    };
}

export function error(ctx: NodeGenContext, error: GenResultError, isFull = false) : ts.Statement {
    if (ctx.resultType.none) return ts.factory.createReturnStatement();
    const finalMsg = _bin_chain(isFull ? error[1] : joinElements(["Expected ", ...error[0], " ", ...error[1]]), ts.SyntaxKind.PlusToken);
    if (ctx.resultType.return) return ts.factory.createReturnStatement(ctx.resultType.return);
    else if (ctx.resultType.returnErr) return ts.factory.createReturnStatement(finalMsg);
    else if (ctx.resultType.throw) return _throw(_new(ctx.resultType.throw, [finalMsg]));
    else if (ctx.resultType.custom) return ctx.resultType.custom(finalMsg);
    else return _throw(_new("Error", [finalMsg]));
}

export function genNode(validator: Validator, ctx: NodeGenContext) : GenResult {
    switch (validator.typeData.kind) {
    case TypeDataKinds.Number: {
        if (validator.typeData.literal) return {
            condition: _bin(validator.expression(), _num(validator.typeData.literal), ts.SyntaxKind.ExclamationEqualsEqualsToken),
            error: [validator.path(), concat`to be equal to ${validator.typeData.literal.toString()}`]
        };
        const errorMessages = [], checks: ts.Expression[] = [_typeof_cmp(validator.expression(), "number", ts.SyntaxKind.ExclamationEqualsEqualsToken)];
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

        if (validator.typeData.min) {
            checks.push(_bin(validator.expression(), validator.typeData.min, ts.SyntaxKind.LessThanToken));
            errorMessages.push(...concat`to be greater than ${validator.typeData.min}`);
        }

        if (validator.typeData.max) {
            checks.push(_bin(validator.expression(), validator.typeData.max, ts.SyntaxKind.GreaterThanToken));
            errorMessages.push(...concat`to be less than ${validator.typeData.max}`);
        }

        return {
            condition: _or(checks),
            error: [validator.path(), joinElements(errorMessages, ", ")]
        };
    }
    case TypeDataKinds.String: {
        if (validator.typeData.literal) return {
            condition: _bin(validator.expression(), _str(validator.typeData.literal), ts.SyntaxKind.ExclamationEqualsEqualsToken),
            error: [validator.path(), concat`to be equal to "${validator.typeData.literal}"`]
        };

        const errorMessages: Stringifyable[] = ["to be a string"], checks: ts.Expression[] = [_typeof_cmp(validator.expression(), "string", ts.SyntaxKind.ExclamationEqualsEqualsToken)];

        if (validator.typeData.length) {
            checks.push(_bin(_access(validator.expression(), "length"), validator.typeData.length, ts.SyntaxKind.ExclamationEqualsEqualsToken));
            errorMessages.push(...concat`to have a length of ${validator.typeData.length}`);
        }

        if (validator.typeData.matches) {
            let regexp;
            if (ts.isStringLiteral(validator.typeData.matches)) {
                if (validator.typeData.matches.text !== "") regexp = ts.factory.createRegularExpressionLiteral(validator.typeData.matches.text);
            } else regexp = validator.typeData.matches;
            if (regexp) {
                checks.push(_not(_call(_access(regexp, "test"), [validator.expression()])));
                errorMessages.push(...concat`to match ${validator.typeData.matches}`);
            }
        }

        if (validator.typeData.minLen) {
            checks.push(_bin(_access(validator.expression(), "length"), validator.typeData.minLen, ts.SyntaxKind.LessThanToken));
            errorMessages.push(...concat`to have a length greater than ${validator.typeData.minLen}`);
        }

        if (validator.typeData.maxLen) {
            checks.push(_bin(_access(validator.expression(), "length"), validator.typeData.maxLen, ts.SyntaxKind.GreaterThanToken));
            errorMessages.push(...concat`to have a length less than ${validator.typeData.maxLen}`);
        }

        return {
            condition: _or(checks),
            error: [validator.path(), joinElements(errorMessages, ", ")]
        };
    }
    case TypeDataKinds.Boolean: return { 
        condition: validator.typeData.literal !== undefined ? _bin(validator.expression(), _bool(validator.typeData.literal), ts.SyntaxKind.ExclamationEqualsEqualsToken) : _typeof_cmp(validator.expression(), "boolean", ts.SyntaxKind.ExclamationEqualsEqualsToken),
        error: [validator.path(), [validator.typeData.literal !== undefined ? _str(`to be ${validator.typeData.literal}`) : _str("to be a boolean")]]
    };
    case TypeDataKinds.BigInt: return {
        condition: _typeof_cmp(validator.expression(), "bigint", ts.SyntaxKind.ExclamationEqualsEqualsToken),
        error: [validator.path(), [_str("to be a bigint")]]
    };
    case TypeDataKinds.Symbol: return {
        condition: _typeof_cmp(validator.expression(), "symbol", ts.SyntaxKind.ExclamationEqualsEqualsToken),
        error: [validator.path(), [_str("to be a symbol")]]
    };
    case TypeDataKinds.Class: return {
        condition: _not(_instanceof(validator.expression(), validator._original.symbol.name)),
        error: [validator.path(), [_str(`to be an instance of "${validator._original.symbol.name}"`)]]
    };
    case TypeDataKinds.Function: return {
        condition: _typeof_cmp(validator.expression(), "function", ts.SyntaxKind.ExclamationEqualsEqualsToken),
        error: [validator.path(), [_str("to be a function")]]
    };
    case TypeDataKinds.Null: return {
        condition: _bin(validator.expression(), ts.factory.createNull(), ts.SyntaxKind.ExclamationEqualsEqualsToken),
        error: [validator.path(), [_str("to be null")]]
    };
    case TypeDataKinds.Undefined: return {
        condition: _bin(validator.expression(), UNDEFINED, ts.SyntaxKind.ExclamationEqualsEqualsToken),
        error: [validator.path(), [_str("to be undefined")]]
    };
    case TypeDataKinds.Tuple: return {
        condition: _not(_call(_access(_ident("Array", true), "isArray"), [validator.expression()])),
        error: [validator.path(), [_str("to be an array")]],
        extra: validator.children.map(c => validateType(c, ctx)).flat()
    };
    case TypeDataKinds.If: {
        if (validator.typeData.fullCheck) {
            const innerGen = genNode(validator.children[0] as Validator, ctx);
            return {
                ...innerGen,
                extra: [_if(_not(ctx.transformer.stringToNode(validator.typeData.expression, { $self: validator.expression() })), error(ctx, [validator.path(), [_str(`to satisfy "${validator.typeData.expression}"`)]])), ...(innerGen.extra || [])]
            };
        } else return {
            condition: _not(ctx.transformer.stringToNode(validator.typeData.expression, { $self: validator.expression() })),
            error: [validator.path(), [_str(`to satisfy "${validator.typeData.expression}"`)]]
        };
    }
    case TypeDataKinds.Union: {
        const compoundTypes: GenResult[] = [], 
            normalTypeConditions: ts.Expression[] = [], 
            normalTypeErrors: GenResultError[] = [],
            objectTypes: GenResult[] = [],
            typeNames: string[] = [];
        let isNullable = false;
        const objectKind = validator.getChildCountOfKind(TypeDataKinds.Object);
        for (const child of validator.children) {
            if (child.typeData.kind === TypeDataKinds.Undefined) {
                isNullable = true;
                continue;
            }
            else if (child.children.length) {
                if (child.typeData.kind === TypeDataKinds.Object && objectKind > 1) {
                    const idRepresent = child.getFirstLiteralChild();
                    if (idRepresent) {
                        child.children.splice(child.children.indexOf(idRepresent), 1);
                        const node = genNode(child, ctx);
                        const childNode = genNode(idRepresent, ctx);
                        objectTypes.push({
                            condition: childNode.condition,
                            error: childNode.error,
                            extra: node.extra
                        });
                    }
                    else compoundTypes.push(genNode(child, ctx));
                }
                else compoundTypes.push(genNode(child, ctx));
            }
            else {
                const node = genNode(child, ctx);
                normalTypeConditions.push(node.condition);
                if (node.error) normalTypeErrors.push(node.error);
            }
            typeNames.push(ctx.transformer.checker.typeToString(child._original));
        }

        if (objectTypes.length) compoundTypes.push({
            condition: _obj_check(validator.expression()),
            extra: [_if_nest(0, objectTypes.map(t => [t.condition, t.extra || []]), error(ctx, [validator.path(), [_str("to be an object")]]))]
        });

        if (!compoundTypes.length) return {
            condition: isNullable ? _and([isNullableNode(validator), ...normalTypeConditions]) : _and(normalTypeConditions),
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            error: normalTypeConditions.length === 1 ? normalTypeErrors[0]! : [validator.path(), [_str("to be one of "), _str(typeNames.join(", "))]],
        };
        else {
            if (!normalTypeConditions.length) {
                const firstCompound = compoundTypes.shift() as GenResult;
                if (isNullable) return {
                    condition: isNullableNode(validator),
                    ifTrue: [
                        _if(firstCompound.condition, error(ctx, firstCompound.error || [[], []])),
                        ...(firstCompound.extra || []),
                        _if_nest(0, compoundTypes.map(t => [t.condition, t.extra || []]), ts.factory.createEmptyStatement())
                    ]
                };
                else return {
                    condition: isNullable ? isNullableNode(validator) : firstCompound.condition,
                    ifTrue: isNullable ? _if(firstCompound.condition, _if_nest(0, compoundTypes.map(t => [t.condition, t.extra || []]), error(ctx, [validator.path(), [_str("to be one of "), _str(typeNames.join(", "))]]))) : _if_nest(0, compoundTypes.map(t => [t.condition, t.extra || []]), error(ctx, [validator.path(), [_str("to be one of "), _str(typeNames.join(", "))]])),
                    ifFalse: firstCompound.extra
                };
            }
            else return {
                condition: isNullable ? _and([isNullableNode(validator), ...normalTypeConditions]) : _and(normalTypeConditions),
                ifTrue: _if_nest(0, compoundTypes.map(t => [t.condition, t.extra || []]), error(ctx, [validator.path(), [_str("to be one of "), _str(typeNames.join(", "))]]))
            };
        }
    }
    case TypeDataKinds.Array: {
        const checks = [_not(_call(_access(_ident("Array", true), "isArray"), [validator.expression()]))], errorMessages: Stringifyable[] = ["to be an array"];

        if (validator.typeData.length) {
            checks.push(_bin(_access(validator.expression(), "length"), validator.typeData.length, ts.SyntaxKind.ExclamationEqualsEqualsToken));
            errorMessages.push(...concat`to have a length of ${validator.typeData.length}`);
        }
    
        if (validator.typeData.minLen) {
            checks.push(_bin(_access(validator.expression(), "length"), validator.typeData.minLen, ts.SyntaxKind.LessThanToken));
            errorMessages.push(...concat`to have a length greater than ${validator.typeData.minLen}`);
        }
    
        if (validator.typeData.maxLen) {
            checks.push(_bin(_access(validator.expression(), "length"), validator.typeData.maxLen, ts.SyntaxKind.GreaterThanToken));
            errorMessages.push(...concat`to have a length less than ${validator.typeData.maxLen}`);
        }

        const index = _ident("i");
        const childType = validator.children[0] as Validator;
        childType.setName(index);
        return {
            condition: _or(checks),
            error: [validator.path(), joinElements(errorMessages, ", ")],
            extra: [_for(validator.expression(), index, validateType(childType, ctx))[0]]
        };
    }
    case TypeDataKinds.Object: {
        const checks: ts.Statement[] = [];
        for (const child of validator.children) {
            checks.push(...validateType(child, ctx));
        }

        const exactProps = validator.exactProps();
        if (exactProps !== undefined) {
            const name = _ident("p");
            checks.push(_for_in(validator.expression(), name, [
                _if(
                    _and(validator.children.filter(c => typeof c.name === "string").map(c => _bin(name, _str(c.name as string), ts.SyntaxKind.ExclamationEqualsEqualsToken))),
                    exactProps === ObjectTypeDataExactOptions.RaiseError ? error(ctx, [validator.path(), joinElements(["Property ", ...validator.path(), ".", name, " is excessive"])], true) : validator.typeData.useDeleteOperator ? ts.factory.createDeleteExpression(_access(validator.expression(), name)) : _bin(_access(validator.expression(), name), UNDEFINED, ts.SyntaxKind.EqualsToken)
                )
            ])[0]);
        }

        return {
            condition: _obj_check(validator.expression()),
            error: [validator.path(), [_str("to be an object")]],
            extra: checks
        };
    }
    default: return emptyGenResult();
    }
}

export function isNullableNode(validator: Validator) : ts.Expression {
    return validator.parent ? _bin(validator.nameAsExpression(), validator.parent.expression(), ts.SyntaxKind.InKeyword) : _bin(validator.expression(), UNDEFINED, ts.SyntaxKind.ExclamationEqualsEqualsToken);
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
    const node = ctx.resultType.return ? minimizeGenResult(genNode(validator, ctx)) : genNode(validator, ctx);
    if (isOptional) {
        if (node.extra || node.ifFalse || node.ifTrue) return [_if(isNullableNode(validator), generateStatements([node], ctx))];
        else return generateStatements([{
            ...node,
            condition: _and([isNullableNode(validator), node.condition])
        }], ctx);
    }
    else return generateStatements([node], ctx);
}

export function minimizeGenResult(result: GenResult, negate?: boolean) : GenResult {
    if (result.ifFalse || result.ifTrue) return result;
    const _join = negate ? _and : _or;
    const _negate = negate ? _not : (exp: ts.Expression) => exp;
    if (!result.extra) return {
        ...result,
        condition: _negate(result.condition),
        minimzed: true
    };
    const ifStatements: ts.Expression[] = [], other: ts.Statement[] = [];
    for (const stmt of result.extra) {
        if (ts.isIfStatement(stmt) && ts.isReturnStatement(stmt.thenStatement) && !stmt.elseStatement) ifStatements.push(_negate(stmt.expression));
        else other.push(stmt);
    }
    return {
        condition: _join([_negate(result.condition), ...ifStatements]),
        extra: other.length ? other : undefined,
        error: result.error,
        minimzed: true
    };
}