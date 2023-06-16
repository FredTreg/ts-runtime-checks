"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../../utils");
const chai_1 = require("chai");
describe("Nullable object members", () => {
    function testObjNull(c) {
        if (typeof c !== "object")
            throw new Error("Expected c to be Obj.");
        if (c["a"] !== null && typeof c["a"] !== "number")
            throw new Error("Expected c.a to be number | null.");
        return c;
    }
    it("Not throw when not null is set", () => {
        (0, chai_1.expect)((0, utils_1.call)(testObjNull, { a: 1 })).to.not.throw();
    });
    it("Throw when nullable member is not of the correct type", () => {
        (0, chai_1.expect)((0, utils_1.call)(testObjNull, { a: "abc" })).to.throw();
    });
    it("Not throw when null is set", () => {
        (0, chai_1.expect)((0, utils_1.call)(testObjNull, { a: null })).to.not.throw();
    });
    it("Throw when undefined is set", () => {
        (0, chai_1.expect)((0, utils_1.call)(testObjNull, { a: undefined })).to.throw();
    });
    it("Throw when member is not defined", () => {
        (0, chai_1.expect)((0, utils_1.call)(testObjNull, {})).to.throw();
    });
    function testOnlyNullMember(c) {
        if (typeof c !== "object")
            throw new Error("Expected c to be ObjNullMember.");
        if (c["a"] !== null)
            throw new Error("Expected c.a to be null.");
        return c;
    }
    it("Throw when not null is set to only-null member", () => {
        (0, chai_1.expect)((0, utils_1.call)(testOnlyNullMember, { a: 1 })).to.throw();
    });
    it("Not throw when null is set to only-null member", () => {
        (0, chai_1.expect)((0, utils_1.call)(testOnlyNullMember, { a: null })).to.not.throw();
    });
    it("Throw when undefined is set to only-null member", () => {
        (0, chai_1.expect)((0, utils_1.call)(testOnlyNullMember, { a: undefined })).to.throw();
    });
    it("Throw when mandatory only-null member is not defined", () => {
        (0, chai_1.expect)((0, utils_1.call)(testOnlyNullMember, {})).to.throw();
    });
});
