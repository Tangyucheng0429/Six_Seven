import { supabaseAdmin } from '../config/supabase.js';
import { parseReceiptImage } from '../services/ocr.service.js';
import { calculateBill } from '../services/calc.service.js';

/**
 * Upload receipt image and run AI OCR scanning.
 * POST /api/receipts/upload
 * Inputs: file (Multipart Form), room_id
 */
export async function uploadReceipt(req, res) {
  const { room_id } = req.body;
  const file = req.file;

  if (!room_id || !file) {
    return res.status(400).json({ error: 'Missing required parameters: room_id, file' });
  }

  try {
    // 1. Confirm room exists and is active
    const { data: room, error: roomError } = await supabaseAdmin
      .from('bill_rooms')
      .select('status')
      .eq('room_id', room_id)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (room.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot upload receipt to a completed room.' });
    }

    // 2. Upload file to Supabase Storage bucket 'receipts'
    // Create bucket if it doesn't exist (failsafe for new databases)
    await supabaseAdmin.storage.createBucket('receipts', { public: true }).catch(() => {
      // Bucket might already exist, fail silently
    });

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${room_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('receipts')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('[Receipt Controller] Storage upload failed:', uploadError);
      return res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` });
    }

    // 3. Get file public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('receipts')
      .getPublicUrl(fileName);

    console.log(`[Receipt Controller] Image uploaded successfully. Public URL: ${publicUrl}`);

    // 4. Run AI OCR pipeline
    const parsedData = await parseReceiptImage(publicUrl);

    // 5. Write to receipts table
    const { data: receipt, error: receiptInsertError } = await supabaseAdmin
      .from('receipts')
      .insert({
        room_id,
        image_url: publicUrl,
        subtotal: parsedData.subtotal,
        tax_amount: parsedData.tax_amount,
        service_charge: parsedData.service_charge,
        total_amount: parsedData.total_amount,
        is_verified: false
      })
      .select()
      .single();

    if (receiptInsertError) {
      console.error('[Receipt Controller] Receipt db insertion failed:', receiptInsertError);
      return res.status(500).json({ error: `Database insertion failed: ${receiptInsertError.message}` });
    }

    // 6. Write to receipt_items table (bulk insert)
    if (parsedData.items && parsedData.items.length > 0) {
      const itemsToInsert = parsedData.items.map(item => ({
        receipt_id: receipt.receipt_id,
        item_name: item.item_name,
        price: item.price,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('receipt_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('[Receipt Controller] Receipt items db insertion failed:', itemsError);
        return res.status(500).json({ error: `Failed to insert receipt items: ${itemsError.message}` });
      }
    }

    // 7. Trigger calculation (EQUAL split will immediately divide among members)
    await calculateBill(room_id);

    return res.status(200).json({
      success: true,
      receipt_id: receipt.receipt_id,
      subtotal: receipt.subtotal,
      tax_amount: receipt.tax_amount,
      service_charge: receipt.service_charge,
      total_amount: receipt.total_amount,
      items: parsedData.items
    });
  } catch (error) {
    console.error('[Receipt Controller] Upload Receipt Exception:', error);
    return res.status(500).json({ error: `AI OCR Receipt scanning failed: ${error.message}` });
  }
}

/**
 * Host manually confirms and adjusts parsed receipt details.
 * PUT /api/receipts/verify
 * Inputs: { receipt_id, subtotal, tax_amount, service_charge, total_amount, items: [ { item_name, price, quantity } ] }
 */
export async function verifyReceipt(req, res) {
  const { receipt_id, subtotal, tax_amount, service_charge, total_amount, items } = req.body;

  if (!receipt_id || subtotal === undefined || total_amount === undefined || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Missing required parameters or invalid items array.' });
  }

  try {
    // 1. Grab receipt details to identify the room
    const { data: oldReceipt, error: getError } = await supabaseAdmin
      .from('receipts')
      .select('room_id')
      .eq('receipt_id', receipt_id)
      .maybeSingle();

    if (getError || !oldReceipt) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    // 2. Perform transactional updates by modifying receipts
    const { data: receipt, error: updateError } = await supabaseAdmin
      .from('receipts')
      .update({
        subtotal: parseFloat(subtotal),
        tax_amount: parseFloat(tax_amount || 0),
        service_charge: parseFloat(service_charge || 0),
        total_amount: parseFloat(total_amount),
        is_verified: true
      })
      .eq('receipt_id', receipt_id)
      .select()
      .single();

    if (updateError) {
      console.error('[Receipt Controller] Receipt update failed:', updateError);
      return res.status(500).json({ error: `Receipt update failed: ${updateError.message}` });
    }

    // 3. Clear old items and rebuild new items
    const { error: deleteError } = await supabaseAdmin
      .from('receipt_items')
      .delete()
      .eq('receipt_id', receipt_id);

    if (deleteError) {
      console.error('[Receipt Controller] Failed clearing old receipt items:', deleteError);
      return res.status(500).json({ error: `Failed resetting receipt items: ${deleteError.message}` });
    }

    if (items.length > 0) {
      const itemsToInsert = items.map(item => ({
        receipt_id,
        item_name: item.item_name || 'Unknown Item',
        price: parseFloat(item.price || 0),
        quantity: parseInt(item.quantity || 1, 10)
      }));

      const { error: insertError } = await supabaseAdmin
        .from('receipt_items')
        .insert(itemsToInsert);

      if (insertError) {
        console.error('[Receipt Controller] Failed inserting verified items:', insertError);
        return res.status(500).json({ error: `Failed saving verified receipt items: ${insertError.message}` });
      }
    }

    // 4. Trigger dynamic bill calculation for room (Equal mode or Item mode recalcs)
    await calculateBill(oldReceipt.room_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Receipt Controller] Verify Receipt Exception:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
