import type { Assert } from "../../../dist/index";
import { call } from "../../utils";
import { expect } from "chai";

type Obj = {
    a: number | null;
};

type ObjNullMember = {
    a: null;
};

describe("Nullable object members", () => {

    function testObjNull(c: Assert<Obj>) {
        return c;
    }

    it("Not throw when not null is set", () => {
        expect(call(testObjNull, { a: 1 })).to.not.throw();
    });

    it("Throw when nullable member is not of the correct type", () => {
        expect(call(testObjNull, {a: "abc"})).to.throw();
    });

    it("Not throw when null is set", () => {
        expect(call(testObjNull, { a: null })).to.not.throw();
    });

    it("Throw when undefined is set", () => {
        expect(call(testObjNull, { a: undefined })).to.throw();
    });

    it("Throw when member is not defined", () => {
        expect(call(testObjNull, {})).to.throw();
    });

    function testOnlyNullMember(c: Assert<ObjNullMember>) {
        return c;
    }

    it("Throw when not null is set to only-null member", () => {
        expect(call(testOnlyNullMember, { a: 1 })).to.throw();
    });

    it("Not throw when null is set to only-null member", () => {
        expect(call(testOnlyNullMember, { a: null })).to.not.throw();
    });

    it("Throw when undefined is set to only-null member", () => {
        expect(call(testOnlyNullMember, { a: undefined })).to.throw();
    });

    it("Throw when mandatory only-null member is not defined", () => {
        expect(call(testOnlyNullMember, {})).to.throw();
    });

});
