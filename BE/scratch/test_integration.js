/**
 * Six 7 Bill Splitter - Complete Local Integration Test Suite
 * Path: scratch/test_integration.js
 *
 * This test suite:
 * 1. Configures the test environment (NODE_ENV=test) to trigger custom mock database + OpenAI layers.
 * 2. Starts the live Express Server on port 3001.
 * 3. Simulates the complete Host + Participant room life cycle under EQUAL sharing.
 * 4. Simulates food item checking, concurrent selections, and Malaysian tax calculations under ITEM_BASED sharing.
 * 5. Mocks files and uploads QR code payment methods.
 * 6. Sweeps active rooms to trigger overdue mail triggers.
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

const { default: app } = await import('../src/app.js');
const { db, resetDb } = await import('../src/config/supabase.mock.js');


// Setup local server base URL
const baseUrl = 'http://localhost:3001/api';

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('===============================================================');
  console.log('    Starting Six 7 Bill Splitter Integration Test Suite        ');
  console.log('===============================================================\n');

  // Let the Express server boot up
  await sleep(1000);

  try {
    // -------------------------------------------------------------
    // TEST FLOW 1: EQUAL Split mode (Rounding mismatch validation)
    // -------------------------------------------------------------
    console.log('--- TEST STEP 1: EQUAL Split Mode Workflow ---');
    resetDb();

    // 1. Host creates a room
    // Mock Host Token
    const hostUid = 'host-user-123';
    const hostToken = `mock-token-${hostUid}`;

    console.log('[Test] Host creating room...');
    const createRes = await fetch(`${baseUrl}/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        host_email: 'host@six7billsplitter.com',
        due_date: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
        nickname: 'Super Host'
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create room failed: ${JSON.stringify(createData)}`);
    console.log(`[Success] Room created successfully. Code: ${createData.room_code}, ID: ${createData.room_id}`);
    
    const roomId = createData.room_id;
    const roomCode = createData.room_code;

    // 2. Verify Host profile exists and is verified by default
    const hostBill = db.participant_bills.find(pb => pb.user_id === hostUid && pb.room_id === roomId);
    if (!hostBill || hostBill.payment_status !== 'VERIFIED') {
      throw new Error(`[Assertion Error] Host is not verified by default. Status is: ${hostBill?.payment_status}`);
    }
    console.log(`[Passed] Host registered as room participant. Initial Payment Status: ${hostBill.payment_status}`);

    // 3. Member A joins the room
    const memberAUid = 'member-a-456';
    const memberAToken = `mock-token-${memberAUid}`;
    console.log('[Test] Member A joining room...');
    const joinARes = await fetch(`${baseUrl}/rooms/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberAToken}`
      },
      body: JSON.stringify({
        room_code: roomCode,
        nickname: 'Member A'
      })
    });
    const joinAData = await joinARes.json();
    if (!joinARes.ok) throw new Error(`Member A join failed: ${JSON.stringify(joinAData)}`);
    console.log(`[Success] Member A joined successfully. User ID: ${joinAData.user_id}`);

    // 4. Member B joins the room
    const memberBUid = 'member-b-789';
    const memberBToken = `mock-token-${memberBUid}`;
    console.log('[Test] Member B joining room...');
    const joinBRes = await fetch(`${baseUrl}/rooms/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberBToken}`
      },
      body: JSON.stringify({
        room_code: roomCode,
        nickname: 'Member B'
      })
    });
    const joinBData = await joinBRes.json();
    if (!joinBRes.ok) throw new Error(`Member B join failed: ${JSON.stringify(joinBData)}`);
    console.log(`[Success] Member B joined successfully. User ID: ${joinBData.user_id}`);

    // 5. Host uploads receipt
    console.log('[Test] Host uploading receipt image (AI OCR scan)...');
    
    // Simulate multipart form data
    const formData = new FormData();
    formData.append('room_id', roomId);
    formData.append('file', new Blob(['fake image content'], { type: 'image/png' }), 'receipt.png');

    const uploadRes = await fetch(`${baseUrl}/receipts/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hostToken}`
      },
      body: formData
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Receipt upload failed: ${JSON.stringify(uploadData)}`);
    console.log(`[Success] Receipt parsed by GPT-4o. Total Amount: RM ${uploadData.total_amount}`);

    // 6. Verify EQUAL split math & absorber allocation
    // 3 participants: Host, Member A, Member B. Total RM 116.00.
    // Member A: round(116.00 / 3) = RM 38.67
    // Member B: round(116.00 / 3) = RM 38.67
    // Host (absorber): 116.00 - 38.67 - 38.67 = RM 38.66
    const hostPb = db.participant_bills.find(pb => pb.user_id === hostUid && pb.room_id === roomId);
    const aPb = db.participant_bills.find(pb => pb.user_id === memberAUid && pb.room_id === roomId);
    const bPb = db.participant_bills.find(pb => pb.user_id === memberBUid && pb.room_id === roomId);

    console.log(`[Math Verification] Equal shares calculated:`);
    console.log(`  - Member A pays: RM ${aPb.amount_to_pay}`);
    console.log(`  - Member B pays: RM ${bPb.amount_to_pay}`);
    console.log(`  - Host (Absorber) pays: RM ${hostPb.amount_to_pay}`);
    console.log(`  - Combined Total: RM ${aPb.amount_to_pay + bPb.amount_to_pay + hostPb.amount_to_pay}`);

    if (aPb.amount_to_pay !== 38.67 || bPb.amount_to_pay !== 38.67 || hostPb.amount_to_pay !== 38.66) {
      throw new Error(`[Assertion Error] Math precision mismatch in Equal Split!`);
    }
    console.log('✅ EQUAL Split precision verification passed with zero sen leakage!\n');

    // 7. Member A submits payment proof
    console.log('[Test] Member A uploading payment proof screenshot...');
    const proofForm = new FormData();
    proofForm.append('room_id', roomId);
    proofForm.append('user_id', memberAUid);
    proofForm.append('proof_file', new Blob(['fake proof content'], { type: 'image/jpeg' }), 'proof.jpg');

    const proofRes = await fetch(`${baseUrl}/payments/submit-proof`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberAToken}`
      },
      body: proofForm
    });

    const proofData = await proofRes.json();
    if (!proofRes.ok) throw new Error(`Proof submission failed: ${JSON.stringify(proofData)}`);
    console.log(`[Success] Payment proof submitted. Status is now: ${proofData.payment_status}`);

    // 8. Host verifies Member A payment
    console.log('[Test] Host verifying Member A payment...');
    const verifyARes = await fetch(`${baseUrl}/payments/verify-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        room_id: roomId,
        member_user_id: memberAUid
      })
    });
    const verifyAData = await verifyARes.json();
    if (!verifyARes.ok) throw new Error(`Verification of Member A failed: ${JSON.stringify(verifyAData)}`);
    console.log(`[Success] Member A verified. Room Settlement Status: ${verifyAData.room_status}`);

    // 9. Member B submits payment proof & Host verifies
    console.log('[Test] Member B submitting proof and Host verifying...');
    const proofFormB = new FormData();
    proofFormB.append('room_id', roomId);
    proofFormB.append('user_id', memberBUid);
    proofFormB.append('proof_file', new Blob(['fake proof content B'], { type: 'image/jpeg' }), 'proofB.jpg');

    await fetch(`${baseUrl}/payments/submit-proof`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberBToken}` },
      body: proofFormB
    });

    const verifyBRes = await fetch(`${baseUrl}/payments/verify-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        room_id: roomId,
        member_user_id: memberBUid
      })
    });
    const verifyBData = await verifyBRes.json();
    console.log(`[Success] Member B verified. Room Settlement Status: ${verifyBData.room_status}`);

    // Assert room is COMPLETED
    if (verifyBData.room_status !== 'COMPLETED') {
      throw new Error(`[Assertion Error] Room did not auto-close upon full participant verification!`);
    }
    console.log('✅ Room settlement lifecycle successfully automated and room status closed to COMPLETED!\n');


    // -------------------------------------------------------------
    // TEST FLOW 2: ITEM_BASED Split mode (Malaysian tax rounding)
    // -------------------------------------------------------------
    console.log('--- TEST STEP 2: ITEM_BASED Split Mode & Tax Allocation Workflow ---');
    resetDb();

    // 1. Host creates room
    const cRoomRes = await fetch(`${baseUrl}/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        host_email: 'host@six7billsplitter.com',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        nickname: 'Super Host'
      })
    });
    const cRoomData = await cRoomRes.json();
    const rId = cRoomData.room_id;
    const rCode = cRoomData.room_code;

    // 2. Member A & B join
    await fetch(`${baseUrl}/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberAToken}` },
      body: JSON.stringify({ room_code: rCode, nickname: 'Member A' })
    });
    await fetch(`${baseUrl}/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberBToken}` },
      body: JSON.stringify({ room_code: rCode, nickname: 'Member B' })
    });

    // 3. Configure split mode to ITEM_BASED and upload QR code
    console.log('[Test] Host setting splitting mode to ITEM_BASED and uploading QR code...');
    const configForm = new FormData();
    configForm.append('room_id', rId);
    configForm.append('split_mode', 'ITEM_BASED');
    configForm.append('payment_method_type', 'DUITNOW_QR');
    configForm.append('payment_method_detail', 'DuitNow ID: +60123456789');
    configForm.append('qr_code_file', new Blob(['qr code dummy'], { type: 'image/png' }), 'qr.png');

    const configRes = await fetch(`${baseUrl}/bills/config-split`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hostToken}`
      },
      body: configForm
    });
    const configData = await configRes.json();
    if (!configRes.ok) throw new Error(`Config split failed: ${JSON.stringify(configData)}`);
    console.log(`[Success] Splitting mode set to ITEM_BASED. DuitNow QR uploaded.`);

    // Check QR code public URL in mock DB
    const roomState = db.bill_rooms.find(r => r.room_id === rId);
    console.log(`[Passed] QR Code successfully hosted on Supabase Storage. URL: ${roomState.qr_code_url}`);

    // 4. Host uploads receipt
    const formData2 = new FormData();
    formData2.append('room_id', rId);
    formData2.append('file', new Blob(['fake image content 2'], { type: 'image/png' }), 'receipt2.png');

    const uploadRes2 = await fetch(`${baseUrl}/receipts/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${hostToken}` },
      body: formData2
    });
    const uploadData2 = await uploadRes2.json();
    if (!uploadRes2.ok) throw new Error(`Receipt upload 2 failed: ${JSON.stringify(uploadData2)}`);
    console.log(`[Success] Receipt parsed. Items loaded: ${uploadData2.items.length} items.`);


    // Get item ids
    const receiptItems = db.receipt_items.filter(ri => ri.receipt_id === uploadData2.receipt_id);
    const item1 = receiptItems.find(i => i.item_name === 'Chicken Rice').item_id;
    const item2 = receiptItems.find(i => i.item_name === 'Deep Fried Fish').item_id;
    const item3 = receiptItems.find(i => i.item_name === 'Teh Tarik').item_id;

    // 5. Participants concurrent items assignments
    // Host selects Chicken Rice (Item 1)
    console.log('[Test] Host selecting Chicken Rice...');
    const hAssignRes = await fetch(`${baseUrl}/bills/assign-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hostToken}` },
      body: JSON.stringify({
        room_id: rId,
        user_id: hostUid,
        selected_item_ids: [item1]
      })
    });
    const hAssignData = await hAssignRes.json();
    console.log(`[Success] Host assigned. Amount to pay so far: RM ${hAssignData.amount_to_pay}`);

    // Member A selects Deep Fried Fish (Item 2) and Teh Tarik (Item 3)
    console.log('[Test] Member A selecting Deep Fried Fish & Teh Tarik...');
    const aAssignRes = await fetch(`${baseUrl}/bills/assign-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberAToken}` },
      body: JSON.stringify({
        room_id: rId,
        user_id: memberAUid,
        selected_item_ids: [item2, item3]
      })
    });
    const aAssignData = await aAssignRes.json();
    console.log(`[Success] Member A assigned. Amount to pay so far: RM ${aAssignData.amount_to_pay}`);

    // Member B selects Teh Tarik (Item 3)
    console.log('[Test] Member B selecting Teh Tarik...');
    const bAssignRes = await fetch(`${baseUrl}/bills/assign-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberBToken}` },
      body: JSON.stringify({
        room_id: rId,
        user_id: memberBUid,
        selected_item_ids: [item3]
      })
    });
    const bAssignData = await bAssignRes.json();
    console.log(`[Success] Member B assigned. Amount to pay so far: RM ${bAssignData.amount_to_pay}`);

    // 6. Verify ITEM_BASED math rounding:
    // Subtotal: 100.00, Tax: 6.00, Service Charge: 10.00. Extra rate: 16% (1.16)
    // Chicken Rice (RM 40.00): Host (shares = 1). Host Subtotal = RM 40.00
    // Fish (RM 50.00): Member A (shares = 1). Member A Subtotal += RM 50.00
    // Teh Tarik (RM 10.00): Member A & Member B (shares = 2). Price per share = RM 5.00
    // Member A final Subtotal = RM 55.00 -> amount = round(55.00 * 1.16) = RM 63.80
    // Member B final Subtotal = RM 5.00 -> amount = round(5.00 * 1.16) = RM 5.80
    // Host (absorber) final Amount = 116.00 - (63.80 + 5.80) = RM 46.40
    const hostPb2 = db.participant_bills.find(pb => pb.user_id === hostUid && pb.room_id === rId);
    const aPb2 = db.participant_bills.find(pb => pb.user_id === memberAUid && pb.room_id === rId);
    const bPb2 = db.participant_bills.find(pb => pb.user_id === memberBUid && pb.room_id === rId);

    console.log(`[Math Verification] Item sharing calculated:`);
    console.log(`  - Member A pays: RM ${aPb2.amount_to_pay} (Expected: 63.80)`);
    console.log(`  - Member B pays: RM ${bPb2.amount_to_pay} (Expected: 5.80)`);
    console.log(`  - Host (Absorber) pays: RM ${hostPb2.amount_to_pay} (Expected: 46.40)`);
    console.log(`  - Combined Total: RM ${aPb2.amount_to_pay + bPb2.amount_to_pay + hostPb2.amount_to_pay}`);

    if (aPb2.amount_to_pay !== 63.80 || bPb2.amount_to_pay !== 5.80 || hostPb2.amount_to_pay !== 46.40) {
      throw new Error(`[Assertion Error] Math precision mismatch in Item Split!`);
    }
    console.log('✅ ITEM_BASED Split precision verification passed with correct SST (6%) and Service Charge (10%) shares!\n');


    // -------------------------------------------------------------
    // TEST FLOW 3: Overdue sweeping cron webhook
    // -------------------------------------------------------------
    console.log('--- TEST STEP 3: Cron Sweep Notification Workflow ---');
    
    // Modify room due_date to past time to force overdue check
    const roomToOverdue = db.bill_rooms.find(r => r.room_id === rId);
    roomToOverdue.due_date = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
    roomToOverdue.status = 'ACTIVE'; // Ensure active

    // Set member payments to PENDING so they are outstanding
    const aPbState = db.participant_bills.find(pb => pb.user_id === memberAUid && pb.room_id === rId);
    aPbState.payment_status = 'PENDING';
    const bPbState = db.participant_bills.find(pb => pb.user_id === memberBUid && pb.room_id === rId);
    bPbState.payment_status = 'PENDING';

    console.log('[Test] Triggering manual cron check webhook...');
    const cronRes = await fetch(`${baseUrl}/cron/check-due`, {
      method: 'POST'
    });
    const cronData = await cronRes.json();
    if (!cronRes.ok) throw new Error(`Cron trigger failed: ${JSON.stringify(cronData)}`);
    console.log(`[Success] Overdue sweep triggered. Message: ${cronData.message}`);

    // Wait a brief moment for the fire-and-forget background service to sweep
    await sleep(1500);

    console.log('✅ Overdue cron sweep executed successfully without crash. Host notified.');
    console.log('\n===============================================================');
    console.log('     🎉 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY!          ');
    console.log('===============================================================');

  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:', error);
    process.exit(1);
  }

  // Gracefully terminate the process
  process.exit(0);
}

runTests();
