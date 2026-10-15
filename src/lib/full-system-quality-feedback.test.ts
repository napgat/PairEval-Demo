import {expect,it} from "vitest";
import {repeatedLowAgreement} from "./full-system-quality-feedback";
it("flags consecutive low agreement for a named criterion, without imputing missing evidence",()=>{
 const rows=[.1,.15,.8].map((value,i)=>({name:"คุณภาพ",side:"GROUP",value,assignmentId:String(i)}));
 expect(repeatedLowAgreement(rows)).toEqual([{criterion:"คุณภาพ",side:"GROUP",assignments:2}]);
 expect(repeatedLowAgreement([{...rows[0],value:null},...rows.slice(1)])).toEqual([]);
 expect(repeatedLowAgreement([{...rows[0],value:.5},...rows.slice(1)])).toEqual([]);
});
