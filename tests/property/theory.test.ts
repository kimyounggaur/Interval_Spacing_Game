import { describe, expect, it } from "vitest";
import { between, invert, isSimple, midiOf, spellings, transpose } from "../../src/theory/index";
import { COMMON } from "../../src/game/generator";

describe("DR1 exhaustive properties",()=>{
 it("TH-06 all simple spellings × 13 intervals × two directions round trip",()=>{
   let checks=0;
   for(let midi=48;midi<=72;midi++)for(const start of spellings(midi).filter(isSimple))for(const iv of COMMON)for(const dir of [1,-1] as const){
    const target=transpose(start,iv.num,iv.quality,dir);if(!target)continue;
    const result=between(start,target);expect(result).toMatchObject({...iv,dir});checks++;
   }expect(checks).toBeGreaterThanOrEqual(800);
 });
 it("TH-07 inversion complements degree and semitone distance",()=>{for(const iv of COMMON){const inverse=invert(iv);expect(iv.num+inverse.num).toBe(9);expect(iv.semis+inverse.semis).toBe(12);expect(invert(inverse)).toEqual(iv);}});
 it("spellings always retain chromatic pitch over the full MIDI range",()=>{for(let midi=0;midi<=127;midi++)for(const n of spellings(midi,2))expect(midiOf(n)).toBe(midi);});
});
