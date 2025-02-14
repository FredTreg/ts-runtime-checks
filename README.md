# ts-runtime-checks

A typescript transformer which automatically generates validation code from your types. Think of it as a validation library like [ajv](https://ajv.js.org/guide/typescript.html) and [ts-runtime](https://github.com/fabiandev/ts-runtime), except it **completely** relies on the typescript compiler, and generates vanilla javascript code on demand. This comes with a lot of advantages:

- It's just types - no extra configuration, boilerplate or schemas needed.
- Only validate where you see fit.
- Makes your app faster - code is generated during the transpilation phase, and can be easily optimized by V8.
- Powerful - built on top of typescript's type system, which is turing-complete.

Here is a very simple example:

```ts
import type { Assert } from "ts-runtime-checks";

type AssertNum = Assert<number>;

function greet(name: Assert<string>, age: AssertNum) : string {
    return `Hello ${name}! I'm ${age} too!`;
}

// Transpiles to:
function greet(name, age) {
    if (typeof name !== "string") throw new Error("Expected name to be string.");
    if (typeof age !== "number") throw new Error("Expected age to be number.");
    return `Hello ${name}! I'm ${age} too!`;
}
```

The special `Assert` type gets detected during transpilation, and replaced with appropriate validation checks.

Check out the [playground](https://googlefeud.github.io/ts-runtime-checks/) if you want to play with the transformer without setting up an enviourment!

## Usage

```
npm i --save-dev ts-runtime-checks
```

Sadly, `tsc` doesn't allow you to add custom transformers, so you must use a tool which adds them:

<details>
    <summary>Usage with ts-patch</summary>

```
npm i --save-dev ts-patch
```

and add the ts-runtime-checks transformer to your tsconfig.json:

```json
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-runtime-checks" }
    ]
}
```

Afterwards you must use the `tspc` CLI command to transpile your typescript code.

See [ts-patch](https://github.com/nonara/ts-patch) for integrating with additional tools such as ts-node.
</details>

<details>
    <summary>Usage with ts-loader</summary>

```js
const TsRuntimeChecks = require("ts-runtime-checks").default;

options: {
      getCustomTransformers: program => {
        before: [TsRuntimeChecks(program)]
      }
}
```
</details>

## `ts-runtime-checks` in depth

### Markers

Markers are typescript type aliases which are detected by the transformer. These types don't represent actual values, but they tell the transformer what code to generate. Think of them as functions! This transformer has two type of markers:

- `Assertions` - Tell the transformer that the value associated with this type needs to be checked during runtime. These types can be used in either **function parameters** or in **type assertions**.
    - `Assert<Type, ErrorType>`
    - `EarlyReturn<Type, ReturnType>`
- `Utility` - Types which perform additional checks. These types should be only used inside `Assertion` types.
    - `Num<{min, max, type}>` - More detailed number requirements.
    - `Str<{matches, length}>` - More detailed string requirements.
    - `Arr<{length, minLen, maxLen}>` - More detailed array requirements.
    - `NoCheck<Type, removeExtra>`- Doesn't generate checks for the provided type.
    - `ExactProps<Obj>` - Makes sure the value doesn't have any excessive properties.
    - `If<Type, Condition, fullCheck>` - Checks if `Condition` is true for the value of type `Type`. 
    - `Expr<string>` - Turns the string into an expression. Can be used in markers which require a javascript value - `EarlyReturn`, `NumRange` and `Matches` for example.

#### Assert<Type, ErrorType>

The `Assert` marker asserts that a value is of the provided type by adding **validation code** that gets executed during runtime. If the value doesn't match the type, it throws a new error of the provided `ErrorType`, and it includes a detailed message of what exactly is wrong.

**Example:**

```ts
function addPlayer(player: Assert<{name: string, id: number}>) : void {
    players.push(player);
}

// Transpiles to:
function addPlayer(player) {
    if (typeof player !== "object") throw new Error("Expected player to be { name: string; id: number; }.");
    if (typeof player["name"] !== "string") throw new Error("Expected player.name to be string.");
    if (typeof player["id"] !== "number") throw new Error("Expected player.id to be number.");
    players.push(player);
}
```

You can provide a custom error if you'd like:

```ts
function getType(element: { type: unknown }) : string {
    return element.type as Assert<string, IncorrectElementType>;
}

// Transpiles to:
function getType(element) {
    if (typeof element.type !== "string") throw new IncorrectElementType("Expected element.type to be string.");
    return element.type;
}
```

#### EarlyReturn<Type, ReturnValue>

Same as `Assert`, except instead of throwing an error, it returns `ReturnValue`, or `undefined` if a return value is not provided:

```ts
function verifyUser({username, id}: EarlyReturn<{username: string, id: If<number, "$self < 100">}>) {
    // Other code
}

// Transpiles to:
function verifyUser({ username, id }) {
    if (typeof username !== "string") return undefined;
    if (id > 100) return undefined;
    // Your code
}
```

You can provide the `ErrorMsg` type to make it return the error strings.

#### Num<{min, max, type}>

Allows you to check if the number is greater than / less than an amount, or if it's a floating point or an integer.

```ts
const someNum = 50;

type AssertRange<min> = Num<{
    type: "int",
    min: min,
    max: Expr<"someNum">
}>

function test(num1: AssertRange<1>, num2: AssertRange<10>, num3: AssertRange<Expr<"someNum">>) {
    // Your code
}

// Transpiles to:
function test(num1, num2, num3) {
    if (typeof num1 !== "number" || num1 % 1 !== 0 || num1 < 1 || num1 > someNum)
        throw new Error("Expected num1 to be an integer, to be greater than 1 and to be less than someNum.");
    if (typeof num2 !== "number" || num2 % 1 !== 0 || num2 < 10 || num2 > someNum)
        throw new Error("Expected num2 to be an integer, to be greater than 10 and to be less than someNum.");
    if (typeof num3 !== "number" || num3 % 1 !== 0 || num3 < someNum || num3 > someNum)
        throw new Error("Expected num3 to be an integer, to be greater than someNum and to be less than someNum.");
}

```

#### Str<settings>

Allows you to check whether the string matches a regex, or whether it's a certain length.

```ts
function test(a: Assert<Str<{
    matches: "/abc/",
    //length: 12,
    minLen: 3,
    maxLen: 100
}>>) {
   // Your code...
}

// Transpiles to:
function test(a) {
    if (typeof a !== "string" || a.length < 3 || a.length > 100 || !/abc/.test(a))
        throw new Error("Expected a to be a string, to have a minimum length of 3, to have a maximum length of 100 and to match /abc/.");
}
```

#### Arr<Type, settings>

Allows you to validate the array's length.

```ts
function test(a: Assert<Arr<number, {
    // length: 10,
    minLen: 1,
    maxLen: 10
}>>) {
   // Your code...
}

// Transpiles to:
function test(a) {
    if (!(a instanceof Array) || a.length < 1 || a.length > 10)
        throw new Error("Expected a to be an Array, to have a minimum length of 1 and to have a maximum length of 10.");
    for (let i_1 = 0; i_1 < a.length; i_1++) {
        const x_1 = a[i_1];
        if (typeof x_1 !== "number")
            throw new Error("Expected " + ("a[" + i_1 + "]") + " to be number.");
    }
}

```

#### NoCheck<Type>

Skips validating the value.

```ts
interface UserRequest {
    name: string,
    id: string,
    value: NoCheck<unknown>
}

function test(req: Assert<UserRequest>) {
    // Your code...
}

// Transpiles to:
function test(req) {
    if (typeof req !== "object") throw new Error("Expected req to be UserRequest.");
    if (typeof req["name"] !== "string") throw new Error("Expected req.name to be string.");
    if (typeof req["id"] !== "string") throw new Error("Expected req.id to be string.");
}
```

#### ExactProps<Type, removeExtra> 

Checks if an object has any "excessive" properties (properties which are not on the type but they are on the object).

If `removeExtra` is true, then instead of an error getting thrown, any excessive properties will be deleted **in place** from the object.

```ts
function test(req: unknown) {
    return req as Assert<ExactProps<{a: string, b: number, c: [string, number]}>>;
}

// Transpiles to:
function test(req) {
    if (typeof req !== "object") throw new Error("Expected req to be { a: string; b: number; c: [string, number]; }.");
    if (typeof req["a"] !== "string") throw new Error("Expected req.a to be string.");
    if (typeof req["b"] !== "number") throw new Error("Expected req.b to be number.");
    if (!(req["c"] instanceof Array)) throw new Error("Expected req.c to be [string, number].");
    if (typeof req["c"][0] !== "string") throw new Error("Expected " + ("req.c[" + 0 + "]") + " to be string.");
    if (typeof req["c"][1] !== "number") throw new Error("Expected " + ("req.c[" + 1 + "]") + " to be number.");
    for (let name_1 in req) {
        if (name_1 !== "a" && name_1 !== "b" && name_1 !== "c")
            throw new Error("Property " + ("req[" + name_1 + "]") + " is excessive.");
    }
    return req;
}
```

#### If<Type, Condition, FullCheck>

Allows you to create custom comparisons by providing a string containing javascript code. You can use `$self` in the expression, it'll be replaced by the expression of the value that's currently being validated. 

`FullCheck` is a boolean - if it's set to true, then validation code will be generated for `Type`, if it's set to false (which is the default), only the condition which you provide will be enough to validate it. 

```ts
// Creating a less flexible version of the Range marker
type Range<min extends number, max extends number> = Assert<If<number, `$self < ${min} && $self > ${max}`>>;

function test(num: Range<1, 5>) {
    // Your code...
}

// Transpiles to:
function test(num) {
    if (!(num < 1 && num > 5)) throw new Error("Expected num to satisfy `$self < 1 && $self > 5`.");
    // Your code...
}
```

### Supported types and code generation

- `string`s and string literals
    - `typeof value === "string"` or `value === "literal"`
- `number`s and number literals
    - `typeof value === "number"` or `value === 420`
- `boolean`
    - `typeof value === "boolean"`
- `symbol`
    - `typeof value === "symbol"`
- `bigint`
    - `typeof value === "bigint"`
- `null`
    - `value === null`
- Tuples (`[a, b, c]`)
    - `value instanceof Array`
    - Each type in the tuple gets checked individually.
- Arrays (`Array<a>`, `a[]`)
    - `value instanceof Array`
    - Each value in the array gets checked via a `for` loop.
- Interfaces and object literals (`{a: b, c: d}`)
    - `typeof value === "object"`
    - Each property in the object gets checked individually.
- Classes
    - `value instanceof Class`
- Enums
- Unions (`a | b | c`)
    - Unions get **partially** validated. If one of the types inside the union is a **compound** type (tuples, arrays, object literals, interfaces), then the validity of that type's members doesn't get checked.

### `as` assertions

You can use `as` type assertions to validate values in expressions. The transformer remembers what's safe to use, so you can't generate the same validation code twice.

```ts
interface Args {
    name: string,
    path: string,
    output: string,
    clusters?: number
}

const args = JSON.parse(process.argv[2] as Assert<string>) as Assert<Args>;

// Transpiles to:
if (typeof process.argv[2] !== "string")
    throw new Error("Expected process.argv[2] to be string.");
const temp_1 = JSON.parse(process.argv[2]);
if (typeof temp_1 !== "object")
    throw new Error("Expected value to be Args.");
if (typeof temp_1["name"] !== "string")
    throw new Error("Expected value.name to be string.");
if (typeof temp_1["path"] !== "string")
    throw new Error("Expected value.path to be string.");
if (typeof temp_1["output"] !== "string")
    throw new Error("Expected value.output to be string.");
if ("clusters" in temp_1 && typeof temp_1["clusters"] !== "number")
    throw new Error("Expected value.clusters to be number.");
const args = temp_1;
```

### `is<Type>(value)` utility function

Utility function. Every call to this function gets replaced with an immediately-invoked arrow function, which returns `true` if the value matches the type, `false` otherwise.

```ts
const val = JSON.parse("[\"Hello\", \"World\"]");;
if (is<[string, number]>(val)) {
    // val is guaranteed to be [string, number]
}

// Transpiles to:

const val = JSON.parse("[\"Hello\", \"World\"]");
if ((() => {
    if (!(val instanceof Array)) return false;
    if (typeof val[0] !== "string") return false;
    if (typeof val[1] !== "number") return false;
    return true;
})()) { 
    // Your code...
}
```

### `check<Type>(value)` utility function

Utility function. Every call to this function gets replaced with an immediately-invoked arrow function, which returns the provided value, along with an array of errors.

```ts
const [value, errors] = check<[string, number]>(JSON.parse("[\"Hello\", \"World\"]"));
if (errors.length) console.log(errors);

// Transpiles to:

const value = JSON.parse("[\"Hello\", \"World\"]");
const errors = [];
if (!(value instanceof Array)) errors.push("Expected value to be [string, number].");
if (typeof value[0] !== "string") errors.push("Expected " + ("value[" + 0 + "]") + " to be string.");
if (typeof value[1] !== "number") errors.push("Expected " + ("value[" + 1 + "]") + " to be number.");
if (errors.length) console.log(errors);
```

### Destructuring

If a value is a destructured object / array, then only the deconstructed properties / elements will get validated.

```ts
function test({user: { skills: [skill1, skill2, skill3] }}: EarlyReturn<{
    user: {
        username: string,
        password: string,
        skills: [string, string?, string?]
    }
}>) {
    // Your code
}

// Transpiles to:
function test({
    user: {
        skills: [skill1, skill2, skill3]
    }
}) {
    if (typeof skill1 !== "string") return undefined;
    if (skill2 !== undefined && typeof skill2 !== "string") return undefined;
    if (skill3 !== undefined && typeof skill3 !== "string") return undefined;
}
```

### Complex types

Markers **can** be used in type aliases, so you can easily create shortcuts to common patterns:

```ts
interface User {
    name: string,
    id: number,
    age: number,
    friends: Array<NoCheck<User>>
}

// You can prefix all your assertion types with a $.
type $User = Assert<User, TypeError>;

function test(a: $User) {
    // your code..
}

// Transpiles to:

function test(a) {
    if (typeof a !== "object") throw new TypeError("Expected a to be User.");
    if (typeof a["name"] !== "string") throw new TypeError("Expected a.name to be string.");
    if (typeof a["id"] !== "number") throw new TypeError("Expected a.id to be number.");
    if (typeof a["age"] !== "number") throw new TypeError("Expected a.age to be number.");
    if (!(a["friends"] instanceof Array)) throw new TypeError("Expected a.friends to be NoCheck<User>[].");
}
```

## Contributing

`ts-runtime-checks` is being maintained by a single person. Contributions are welcome and appreciated. Feel free to open an issue or create a pull request at https://github.com/GoogleFeud/ts-runtime-checks