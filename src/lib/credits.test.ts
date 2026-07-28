import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARACTER_CREATION_CREDITS,
  PUNCH_15S_CREDITS,
  WELCOME_CREDITS,
  productionCreditCost,
} from "@/lib/credits";

test("the welcome grant covers one actor and one 15-second Punch", () => {
  assert.equal(CHARACTER_CREATION_CREDITS + PUNCH_15S_CREDITS, WELCOME_CREDITS);
});

test("only a 15-second Punch uses the current production welcome price", () => {
  assert.equal(productionCreditCost("punch", 15), 75);
  assert.equal(productionCreditCost("punch", 5), 0);
  assert.equal(productionCreditCost("spark", 5), 0);
  assert.equal(productionCreditCost("episode", 60), 0);
});
