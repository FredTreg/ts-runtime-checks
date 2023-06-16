import type { Assert } from "../../../dist/index";
import { call } from "../../utils";
import { expect } from "chai";

interface Test {
    a: string,
    b?: number
    c?: number | null
}

describe("Object", () => {
    describe("Assert", () => {
        function test(a: Assert<Test & { d: Array<string> }>) {
            return a;
        }

        it("Throw when one of the properties has the wrong type", () => {
            expect(call(test, {
                a: "ABC",
                d: 123
            })).to.throw("Expected a.d to be string[].");
            expect(call(test, {
                a: "ABC",
                b: "abc",
                d: 123
            })).to.throw("Expected a.b to be number.");
            expect(call(test, {
                a: "ABC",
                b: 123,
                c: "abc",
                d: [1]
            })).to.throw("Expected a.c to be number | null.");
            expect(call(test, {
                a: "ABC",
                b: 123,
                c: 456,
                d: [1]
            })).to.throw("Expected a.d[0] to be string.");
        });
    
        it("Not throw when all of the values are of the same type", () => {
            expect(call(test, {
                a: "ABC",
                b: 123,
                c: null,
                d: ["Hello"]
            })).to.not.throw();
        });

    });

});