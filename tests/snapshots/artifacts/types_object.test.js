"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../../utils");
const chai_1 = require("chai");
describe("Object", () => {
    describe("Assert", () => {
        function test(a) {
            if (typeof a !== "object")
                throw new Error("Expected a to be Test & { d: string[]; }.");
            if (typeof a["a"] !== "string")
                throw new Error("Expected a.a to be string.");
            if ("b" in a && typeof a["b"] !== "number")
                throw new Error("Expected a.b to be number.");
            if ("c" in a && (a["c"] !== null && typeof a["c"] !== "number"))
                throw new Error("Expected a.c to be number | null.");
            if (!(a["d"] instanceof Array))
                throw new Error("Expected a.d to be string[].");
            for (let i_1 = 0; i_1 < a["d"].length; i_1++) {
                const x_1 = a["d"][i_1];
                if (typeof x_1 !== "string")
                    throw new Error("Expected " + ("a.d[" + i_1 + "]") + " to be string.");
            }
            return a;
        }
        it("Throw when one of the properties has the wrong type", () => {
            (0, chai_1.expect)((0, utils_1.call)(test, {
                a: "ABC",
                d: 123
            })).to.throw("Expected a.d to be string[].");
            (0, chai_1.expect)((0, utils_1.call)(test, {
                a: "ABC",
                b: "abc",
                d: 123
            })).to.throw("Expected a.b to be number.");
            (0, chai_1.expect)((0, utils_1.call)(test, {
                a: "ABC",
                b: 123,
                c: "abc",
                d: [1]
            })).to.throw("Expected a.c to be number | null.");
            (0, chai_1.expect)((0, utils_1.call)(test, {
                a: "ABC",
                b: 123,
                c: 456,
                d: [1]
            })).to.throw("Expected a.d[0] to be string.");
        });
        it("Not throw when all of the values are of the same type", () => {
            (0, chai_1.expect)((0, utils_1.call)(test, {
                a: "ABC",
                b: 123,
                c: null,
                d: ["Hello"]
            })).to.not.throw();
        });
    });
});
