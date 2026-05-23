/**
 * Six 7 Bill Splitter - Math Calculation & Precision Test Runner
 * Path: src/tests/test_flow.js
 * Run this file using Node.js to verify the mathematical accuracy, Malaysian sen precision matching,
 * and subtraction-based Host rounding error absorption.
 */

import { roundToTwoDecimals } from '../utils/helpers.js';

// -------------------------------------------------------------
// Test Case 1: EQUAL Split (Rounding discrepancy check)
// Total Bill: RM 10.00, shared by 3 people (Host + 2 Members).
// Expected: Members pay RM 3.33 each. Host absorbs the 1 sen gap and pays RM 3.34.
// -------------------------------------------------------------
function testEqualSplit() {
  console.log('--- TEST 1: EQUAL Split Precision Rounding ---');
  const totalAmount = 10.00;
  const totalPeople = 3;
  
  // Non-absorber members pay standard rounded share
  const baseShare = roundToTwoDecimals(totalAmount / totalPeople);
  
  // 2 members (non-absorbers)
  const nonAbsorbersCount = totalPeople - 1;
  const sumNonAbsorbers = baseShare * nonAbsorbersCount;
  
  // Host absorbs the difference
  const hostShare = roundToTwoDecimals(totalAmount - sumNonAbsorbers);
  
  const calculatedTotal = roundToTwoDecimals(sumNonAbsorbers + hostShare);
  
  console.log(`Receipt Total: RM ${totalAmount.toFixed(2)}`);
  console.log(`Member A pays: RM ${baseShare.toFixed(2)}`);
  console.log(`Member B pays: RM ${baseShare.toFixed(2)}`);
  console.log(`Host (Absorber) pays: RM ${hostShare.toFixed(2)}`);
  console.log(`Calculated Sum: RM ${calculatedTotal.toFixed(2)}`);
  console.log(`Precision Gap: RM ${(totalAmount - calculatedTotal).toFixed(4)}`);
  
  if (calculatedTotal === totalAmount && hostShare === 3.34) {
    console.log('✅ TEST 1 PASSED: Rounding gap perfectly balanced with no sen leakage.\n');
  } else {
    console.error('❌ TEST 1 FAILED\n');
  }
}

// -------------------------------------------------------------
// Test Case 2: ITEM_BASED Split (Malaysian local tax and shares count check)
// Receipt details:
//   Subtotal = RM 100.00
//   SST (6%) = RM 6.00
//   Service Charge (10%) = RM 10.00
//   Total Amount = RM 116.00
//   Extra Tax Rate = (6.00 + 10.00) / 100.00 = 16% (0.16)
//
// Items purchased:
//   1. Chicken Rice: RM 20.00 * 2 = RM 40.00
//   2. Deep Fried Fish: RM 50.00 * 1 = RM 50.00
//   3. Teh Tarik: RM 5.00 * 2 = RM 10.00
//   (Sum of items subtotal = RM 100.00)
//
// Shared assignments:
//   - Host (Absorber): Selects Chicken Rice. (Shares = 1, cost = RM 40.00)
//   - Member A (Non-absorber): Selects Deep Fried Fish & Teh Tarik. (Fish shares = 1, cost = RM 50.00; Teh Tarik shares = 2, cost = RM 5.00. Total = RM 55.00)
//   - Member B (Non-absorber): Selects Teh Tarik. (Teh Tarik shares = 2, cost = RM 5.00)
//
// Math expectation:
//   Extra Rate: 16% (1.16)
//   Member A pays: RM 55.00 * 1.16 = RM 63.80
//   Member B pays: RM 5.00 * 1.16 = RM 5.80
//   Host pays: RM 116.00 - (63.80 + 5.80) = RM 46.40
// -------------------------------------------------------------
function testItemBasedSplit() {
  console.log('--- TEST 2: ITEM_BASED Split (Malaysian Tax Context) ---');
  const receipt = {
    subtotal: 100.00,
    tax_amount: 6.00,
    service_charge: 10.00,
    total_amount: 116.00
  };
  
  const items = [
    { id: 'item-1', name: 'Chicken Rice', price: 20.00, quantity: 2, total: 40.00 },
    { id: 'item-2', name: 'Deep Fried Fish', price: 50.00, quantity: 1, total: 50.00 },
    { id: 'item-3', name: 'Teh Tarik', price: 5.00, quantity: 2, total: 10.00 }
  ];
  
  // Assignment shares:
  // Item 1 (Chicken Rice): [Host] -> shares_count = 1
  // Item 2 (Deep Fried Fish): [Member A] -> shares_count = 1
  // Item 3 (Teh Tarik): [Member A, Member B] -> shares_count = 2
  
  const assignments = [
    { item_id: 'item-1', user_id: 'host' },
    { item_id: 'item-2', user_id: 'member-a' },
    { item_id: 'item-3', user_id: 'member-a' },
    { item_id: 'item-3', user_id: 'member-b' }
  ];
  
  const extraRate = (receipt.tax_amount + receipt.service_charge) / receipt.subtotal;
  console.log(`Extra tax/charge rate: ${(extraRate * 100).toFixed(2)}%`);
  
  // Helper to count shares
  const getSharesCount = (itemId) => {
    return assignments.filter(a => a.item_id === itemId).length;
  };
  
  // Calculate for Member A
  const memberAItems = items.filter(i => assignments.some(a => a.item_id === i.id && a.user_id === 'member-a'));
  let memberASubtotal = 0;
  memberAItems.forEach(item => {
    const shares = getSharesCount(item.id);
    memberASubtotal += (item.price * item.quantity) / shares;
  });
  const memberAPay = roundToTwoDecimals(memberASubtotal * (1 + extraRate));
  
  // Calculate for Member B
  const memberBItems = items.filter(i => assignments.some(a => a.item_id === i.id && a.user_id === 'member-b'));
  let memberBSubtotal = 0;
  memberBItems.forEach(item => {
    const shares = getSharesCount(item.id);
    memberBSubtotal += (item.price * item.quantity) / shares;
  });
  const memberBPay = roundToTwoDecimals(memberBSubtotal * (1 + extraRate));
  
  // Host absorbs the rounding/remainder
  const sumNonAbsorbers = memberAPay + memberBPay;
  const hostPay = roundToTwoDecimals(receipt.total_amount - sumNonAbsorbers);
  
  const calculatedTotal = roundToTwoDecimals(sumNonAbsorbers + hostPay);
  
  console.log(`Receipt Total: RM ${receipt.total_amount.toFixed(2)}`);
  console.log(`Member A (Non-absorber) subtotal: RM ${memberASubtotal.toFixed(2)}, pays: RM ${memberAPay.toFixed(2)}`);
  console.log(`Member B (Non-absorber) subtotal: RM ${memberBSubtotal.toFixed(2)}, pays: RM ${memberBPay.toFixed(2)}`);
  console.log(`Host (Absorber) pays: RM ${hostPay.toFixed(2)}`);
  console.log(`Calculated Sum: RM ${calculatedTotal.toFixed(2)}`);
  console.log(`Precision Gap: RM ${(receipt.total_amount - calculatedTotal).toFixed(4)}`);
  
  if (calculatedTotal === receipt.total_amount && hostPay === 46.40) {
    console.log('✅ TEST 2 PASSED: Item-based calculation fits perfectly and Host absorbs rounding gaps.');
  } else {
    console.error('❌ TEST 2 FAILED');
  }
}

// Execute tests
console.log('=====================================================');
console.log('Starting Six 7 Bill Splitter Backend Math Test Sweeps');
console.log('=====================================================');
testEqualSplit();
testItemBasedSplit();
console.log('=====================================================');
